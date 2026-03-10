import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { deactivateExpiredLicenseByKey } from '@/lib/licenseExpirySync';

const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS_PER_IP = 60;
const DEFAULT_MAX_ATTEMPTS_PER_LICENSE = 20;

const reasonResponseMap = {
  known_device: { status: 200, message: 'Authorized' },
  new_device_bound: { status: 200, message: 'Authorized and bound' },
  license_not_found: { status: 401, message: 'Invalid license' },
  license_inactive: { status: 403, message: 'License inactive' },
  license_expired: { status: 403, message: 'License expired' },
  device_limit_reached: { status: 403, message: 'Device limit reached' },
  rate_limited_ip: { status: 429, message: 'Too many attempts from this IP' },
  rate_limited_license: { status: 429, message: 'Too many attempts for this license' },
};

const EMPTY_EXPIRY_META = {
  expiresAt: null,
  isExpired: null,
  expiresInSeconds: null,
};

export function buildAuthResponse(success, message, expiryMeta = EMPTY_EXPIRY_META) {
  return {
    success,
    message,
    expiresAt: expiryMeta?.expiresAt ?? null,
    isExpired: expiryMeta?.isExpired ?? null,
    expiresInSeconds: expiryMeta?.expiresInSeconds ?? null,
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
    body: buildAuthResponse(decision.success, mappedResponse.message, expiryMeta),
  };
}
