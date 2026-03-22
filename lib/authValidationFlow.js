import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { deactivateExpiredLicenseByKey } from '@/lib/licenseExpirySync';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS_PER_IP = 60;
const DEFAULT_MAX_ATTEMPTS_PER_LICENSE = 20;
const DEFAULT_SINGLE_SESSION_TTL_SECONDS = 1800;

const reasonResponseMap = {
  known_device: { status: 200, message: 'Authorized' },
  new_device_bound: { status: 200, message: 'Authorized and bound' },
  license_not_found: { status: 401, message: 'Invalid license' },
  license_inactive: { status: 403, message: 'License inactive' },
  license_expired: { status: 403, message: 'License expired' },
  device_limit_reached: { status: 403, message: 'Device limit reached' },
  rate_limited_ip: { status: 429, message: 'Too many attempts from this IP' },
  rate_limited_license: { status: 429, message: 'Too many attempts for this license' },
  session_active: { status: 409, message: 'License already has an active session' },
};

const EMPTY_EXPIRY_META = {
  expiresAt: null,
  isExpired: null,
  expiresInSeconds: null,
};

const EMPTY_SESSION_META = {
  sessionId: null,
  sessionToken: null,
  sessionExpiresInSeconds: null,
};

export function buildAuthResponse(
  success,
  message,
  expiryMeta = EMPTY_EXPIRY_META,
  sessionMeta = EMPTY_SESSION_META
) {
  return {
    success,
    message,
    expiresAt: expiryMeta?.expiresAt ?? null,
    isExpired: expiryMeta?.isExpired ?? null,
    expiresInSeconds: expiryMeta?.expiresInSeconds ?? null,
    sessionId: sessionMeta?.sessionId ?? null,
    sessionToken: sessionMeta?.sessionToken ?? null,
    sessionExpiresInSeconds: sessionMeta?.sessionExpiresInSeconds ?? null,
  };
}

function parseExpiryIso(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function buildExpiryMeta(expiresAtValue, unknownWhenMissing = false) {
  const expiresAt = parseExpiryIso(expiresAtValue);
  if (!expiresAt) {
    return {
      expiresAt: null,
      isExpired: unknownWhenMissing ? null : false,
      expiresInSeconds: null,
    };
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();

  return {
    expiresAt,
    isExpired: expiresAtMs <= nowMs,
    expiresInSeconds: Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000)),
  };
}

function getNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function isSingleSessionEnforced() {
  const raw = String(process.env.AUTH_SINGLE_SESSION_ENFORCED ?? 'true')
    .trim()
    .toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function getSingleSessionTtlSeconds() {
  const value = Number(
    process.env.AUTH_SINGLE_SESSION_TTL_SECONDS ?? DEFAULT_SINGLE_SESSION_TTL_SECONDS
  );

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(86400, Math.floor(value));
}

function allowLegacySameHwidReuse() {
  const raw = String(process.env.AUTH_SINGLE_SESSION_ALLOW_LEGACY_SAME_HWID ?? 'true')
    .trim()
    .toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function getSessionSecret() {
  const secret =
    process.env.AUTH_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SECRET_KEY;

  if (!secret || String(secret).trim() === '') {
    return null;
  }

  return String(secret);
}

function signSessionPayload(payloadBase64) {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  return createHmac('sha256', secret).update(payloadBase64).digest('hex');
}

function createSessionHandshake(normalizedLicenseKey, hwidHash, fixedSessionId) {
  const ttlSeconds = getSingleSessionTtlSeconds();
  if (ttlSeconds <= 0) {
    return EMPTY_SESSION_META;
  }

  const sessionId = fixedSessionId || randomUUID();
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + ttlSeconds;

  const payload = {
    sid: sessionId,
    lic: normalizedLicenseKey,
    hwid: hwidHash,
    iat: issuedAtSeconds,
    exp: expiresAtSeconds,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signSessionPayload(payloadBase64);

  if (!signature) {
    return EMPTY_SESSION_META;
  }

  return {
    sessionId,
    sessionToken: `${payloadBase64}.${signature}`,
    sessionExpiresInSeconds: ttlSeconds,
  };
}

function isTimingSafeHexEqual(leftHex, rightHex) {
  if (
    typeof leftHex !== 'string' ||
    typeof rightHex !== 'string' ||
    leftHex.length !== rightHex.length
  ) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(leftHex, 'hex'), Buffer.from(rightHex, 'hex'));
  } catch {
    return false;
  }
}

function parseAndVerifySessionToken(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') {
    return { valid: false };
  }

  const dotIndex = sessionToken.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex >= sessionToken.length - 1) {
    return { valid: false };
  }

  const payloadBase64 = sessionToken.slice(0, dotIndex);
  const signature = sessionToken.slice(dotIndex + 1);
  const expectedSignature = signSessionPayload(payloadBase64);

  if (!expectedSignature || !isTimingSafeHexEqual(signature, expectedSignature)) {
    return { valid: false };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false };
  }

  if (!payload || typeof payload !== 'object') {
    return { valid: false };
  }

  const sessionId = typeof payload.sid === 'string' ? payload.sid : '';
  const licenseKey = typeof payload.lic === 'string' ? payload.lic : '';
  const payloadHwid = typeof payload.hwid === 'string' ? payload.hwid : '';
  const expiresAtSeconds = Number(payload.exp);

  if (!sessionId || !licenseKey || !payloadHwid || !Number.isFinite(expiresAtSeconds)) {
    return { valid: false };
  }

  const remainingSeconds = Math.floor(expiresAtSeconds - Date.now() / 1000);
  if (remainingSeconds <= 0) {
    return { valid: false };
  }

  return {
    valid: true,
    payload: {
      sessionId,
      licenseKey,
      hwidHash: payloadHwid,
      remainingSeconds,
    },
  };
}

function validateSessionHandshake(normalizedLicenseKey, hwidHash, sessionId, sessionToken) {
  if (!sessionId || !sessionToken) {
    return { valid: false };
  }

  const verified = parseAndVerifySessionToken(sessionToken);
  if (!verified.valid) {
    return { valid: false };
  }

  const payload = verified.payload;
  if (
    payload.sessionId !== sessionId ||
    payload.licenseKey !== normalizedLicenseKey ||
    payload.hwidHash !== hwidHash
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    sessionId: payload.sessionId,
    sessionExpiresInSeconds: payload.remainingSeconds,
  };
}

function getClientIp(req) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return null;
}

async function countRecentAttempts(column, value, sinceIso) {
  const { count, error } = await supabaseAdmin
    .from('auth_logs')
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .gte('created_at', sinceIso);

  if (error) {
    console.error(`Rate limit count failed for ${column}:`, error.message || error);
    return null;
  }

  return count || 0;
}

async function checkRateLimit(licenseKey, clientIp) {
  const windowSeconds = getNumberEnv('AUTH_RATE_LIMIT_WINDOW_SECONDS', DEFAULT_RATE_LIMIT_WINDOW_SECONDS);
  const maxPerIp = getNumberEnv('AUTH_RATE_LIMIT_MAX_PER_IP', DEFAULT_MAX_ATTEMPTS_PER_IP);
  const maxPerLicense = getNumberEnv('AUTH_RATE_LIMIT_MAX_PER_LICENSE', DEFAULT_MAX_ATTEMPTS_PER_LICENSE);
  const sinceIso = new Date(Date.now() - windowSeconds * 1000).toISOString();

  if (clientIp) {
    const ipAttempts = await countRecentAttempts('client_ip', clientIp, sinceIso);
    if (ipAttempts !== null && ipAttempts >= maxPerIp) {
      return { limited: true, reason: 'rate_limited_ip', retryAfter: windowSeconds };
    }
  }

  const licenseAttempts = await countRecentAttempts('license_key', licenseKey, sinceIso);
  if (licenseAttempts !== null && licenseAttempts >= maxPerLicense) {
    return { limited: true, reason: 'rate_limited_license', retryAfter: windowSeconds };
  }

  return { limited: false };
}

async function getActiveSessionLock(licenseKey, hwidHash, clientIp) {
  if (!isSingleSessionEnforced()) {
    return { blocked: false };
  }

  const ttlSeconds = getSingleSessionTtlSeconds();
  if (ttlSeconds <= 0) {
    return { blocked: false };
  }

  const sinceIso = new Date(Date.now() - ttlSeconds * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('auth_logs')
    .select('created_at, hwid_hash, client_ip')
    .eq('license_key', licenseKey)
    .eq('result', 'approved')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Single-session lookup failed:', error.message || error);
    return { blocked: false };
  }

  if (!data?.created_at) {
    return { blocked: false };
  }

  const activeUntilMs = new Date(data.created_at).getTime() + ttlSeconds * 1000;
  if (Number.isNaN(activeUntilMs)) {
    return { blocked: false };
  }

  const retryAfter = Math.max(1, Math.ceil((activeUntilMs - Date.now()) / 1000));
  if (retryAfter <= 0) {
    return { blocked: false };
  }

  if (allowLegacySameHwidReuse() && data.hwid_hash === hwidHash) {
    const activeIp = data.client_ip ? String(data.client_ip).trim() : '';
    if (!activeIp || !clientIp || activeIp === clientIp) {
      return {
        blocked: false,
        compatibilityBypass: true,
      };
    }
  }

  return {
    blocked: true,
    retryAfter,
  };
}

async function writeAuthLog(licenseKey, hwidHash, success, reason, clientIp) {
  const { error } = await supabaseAdmin.from('auth_logs').insert({
    license_key: licenseKey,
    hwid_hash: hwidHash,
    result: success ? 'approved' : 'denied',
    reason,
    client_ip: clientIp,
  });

  if (error) {
    console.error('Failed to write auth log:', error);
  }
}

async function getLicenseExpiryMeta(licenseKey) {
  const { data: license, error } = await supabaseAdmin
    .from('licenses')
    .select('expires_at')
    .eq('license_key', licenseKey)
    .maybeSingle();

  if (error) {
    console.error('Failed to load license expiry metadata:', error.message || error);
    return {
      expiresAt: null,
      isExpired: null,
      expiresInSeconds: null,
    };
  }

  if (!license) {
    return {
      expiresAt: null,
      isExpired: null,
      expiresInSeconds: null,
    };
  }

  return buildExpiryMeta(license.expires_at);
}

async function syncDeviceActiveState(licenseKey, hwidHash, deviceName) {
  const { data: license, error: licenseError } = await supabaseAdmin
    .from('licenses')
    .select('id')
    .eq('license_key', licenseKey)
    .maybeSingle();

  if (licenseError || !license) {
    if (licenseError) {
      console.error('Failed to load license for device sync:', licenseError);
    }
    return;
  }

  const updatePayload = {
    status: 'active',
    last_seen_at: new Date().toISOString(),
  };

  if (deviceName && String(deviceName).trim() !== '') {
    updatePayload.device_name = String(deviceName).trim();
  }

  const { error: updateError } = await supabaseAdmin
    .from('devices')
    .update(updatePayload)
    .eq('license_id', license.id)
    .eq('hwid_hash', hwidHash);

  if (updateError) {
    console.error('Failed to sync device active state:', updateError);
  }
}

async function bindDeviceWithRpc(licenseKey, hwidHash, deviceName) {
  const { data, error } = await supabaseAdmin.rpc('bind_device_if_allowed', {
    p_license_key: licenseKey,
    p_hwid_hash: hwidHash,
    p_device_name: deviceName || null,
  });

  if (error) {
    return { error };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.success !== 'boolean') {
    return { error: new Error('Unexpected RPC response payload') };
  }

  const hasExpiryField = Object.prototype.hasOwnProperty.call(row, 'expires_at');

  return {
    success: row.success,
    reason: row.reason || (row.success ? 'known_device' : 'denied'),
    ...(hasExpiryField ? { expiresAt: parseExpiryIso(row.expires_at) } : {}),
  };
}

async function legacyBindDevice(licenseKey, hwidHash, deviceName) {
  const { data: license, error: licenseError } = await supabaseAdmin
    .from('licenses')
    .select('id, status, expires_at, max_devices')
    .eq('license_key', licenseKey)
    .maybeSingle();

  if (licenseError) {
    throw licenseError;
  }

  if (!license) {
    return { success: false, reason: 'license_not_found', expiresAt: null };
  }

  if (license.status !== 'active') {
    return { success: false, reason: 'license_inactive', expiresAt: parseExpiryIso(license.expires_at) };
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { success: false, reason: 'license_expired', expiresAt: parseExpiryIso(license.expires_at) };
  }

  const { data: knownDevice, error: knownDeviceError } = await supabaseAdmin
    .from('devices')
    .select('id')
    .eq('license_id', license.id)
    .eq('hwid_hash', hwidHash)
    .maybeSingle();

  if (knownDeviceError) {
    throw knownDeviceError;
  }

  if (knownDevice) {
    await supabaseAdmin
      .from('devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', knownDevice.id);

    return { success: true, reason: 'known_device', expiresAt: parseExpiryIso(license.expires_at) };
  }

  const { count, error: countError } = await supabaseAdmin
    .from('devices')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', license.id);

  if (countError) {
    throw countError;
  }

  if ((count || 0) >= license.max_devices) {
    return { success: false, reason: 'device_limit_reached', expiresAt: parseExpiryIso(license.expires_at) };
  }

  const { error: insertError } = await supabaseAdmin.from('devices').insert({
    license_id: license.id,
    hwid_hash: hwidHash,
    device_name: deviceName || 'Unknown device',
    status: 'active',
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: true, reason: 'known_device', expiresAt: parseExpiryIso(license.expires_at) };
    }

    throw insertError;
  }

  return { success: true, reason: 'new_device_bound', expiresAt: parseExpiryIso(license.expires_at) };
}

export async function validateLicenseAccess({
  req,
  normalizedLicenseKey,
  hwidHash,
  deviceName,
  sessionId,
  sessionToken,
}) {
  const clientIp = getClientIp(req);
  const rateLimitCheck = await checkRateLimit(normalizedLicenseKey, clientIp);

  if (rateLimitCheck.limited) {
    await writeAuthLog(normalizedLicenseKey, hwidHash, false, rateLimitCheck.reason, clientIp);
    const rateLimitExpiryMeta = await getLicenseExpiryMeta(normalizedLicenseKey);
    const mappedLimitResponse = reasonResponseMap[rateLimitCheck.reason];

    return {
      success: false,
      reason: rateLimitCheck.reason,
      status: mappedLimitResponse.status,
      headers: { 'Retry-After': String(rateLimitCheck.retryAfter) },
      body: buildAuthResponse(false, mappedLimitResponse.message, rateLimitExpiryMeta),
    };
  }

  const validatedSession = validateSessionHandshake(
    normalizedLicenseKey,
    hwidHash,
    sessionId,
    sessionToken
  );

  const sessionLock = validatedSession.valid
    ? { blocked: false }
    : await getActiveSessionLock(normalizedLicenseKey, hwidHash, clientIp);

  if (sessionLock.blocked) {
    await writeAuthLog(normalizedLicenseKey, hwidHash, false, 'session_active', clientIp);
    const sessionLockExpiryMeta = await getLicenseExpiryMeta(normalizedLicenseKey);
    const mappedSessionResponse = reasonResponseMap.session_active;
    return {
      success: false,
      reason: 'session_active',
      status: mappedSessionResponse.status,
      headers: { 'Retry-After': String(sessionLock.retryAfter) },
      body: buildAuthResponse(
        false,
        `${mappedSessionResponse.message}. Try again in ${sessionLock.retryAfter}s`,
        sessionLockExpiryMeta
      ),
    };
  }

  let decision = await bindDeviceWithRpc(normalizedLicenseKey, hwidHash, deviceName);

  if (decision.error) {
    console.error('RPC bind failed, falling back to legacy flow:', decision.error);
    decision = await legacyBindDevice(normalizedLicenseKey, hwidHash, deviceName);
  }

  const mappedResponse = reasonResponseMap[decision.reason] || {
    status: decision.success ? 200 : 403,
    message: decision.success ? 'Authorized' : 'Access denied',
  };

  const expiryMeta =
    decision.expiresAt !== undefined
      ? buildExpiryMeta(decision.expiresAt, decision.reason === 'license_not_found')
      : await getLicenseExpiryMeta(normalizedLicenseKey);

  const sessionMeta = decision.success
    ? createSessionHandshake(
        normalizedLicenseKey,
        hwidHash,
        validatedSession.valid ? validatedSession.sessionId : undefined
      )
    : EMPTY_SESSION_META;

  if (decision.success) {
    await syncDeviceActiveState(normalizedLicenseKey, hwidHash, deviceName);
  } else if (decision.reason === 'license_expired') {
    await deactivateExpiredLicenseByKey(normalizedLicenseKey);
  }

  await writeAuthLog(normalizedLicenseKey, hwidHash, decision.success, decision.reason, clientIp);

  return {
    success: decision.success,
    reason: decision.reason,
    status: mappedResponse.status,
    body: buildAuthResponse(decision.success, mappedResponse.message, expiryMeta, sessionMeta),
  };
}
