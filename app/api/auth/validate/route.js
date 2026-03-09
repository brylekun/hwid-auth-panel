import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeLicenseKey } from '@/lib/licenseKey';
import { validateBodySchema } from '@/lib/validation';
import { NextResponse } from 'next/server';

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

function isMissingRpcError(error) {
  return (
    error?.code === 'PGRST202' ||
    error?.message?.includes('bind_device_if_allowed')
  );
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

  return {
    success: row.success,
    reason: row.reason || (row.success ? 'known_device' : 'denied'),
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
    return { success: false, reason: 'license_not_found' };
  }

  if (license.status !== 'active') {
    return { success: false, reason: 'license_inactive' };
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { success: false, reason: 'license_expired' };
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

    return { success: true, reason: 'known_device' };
  }

  const { count, error: countError } = await supabaseAdmin
    .from('devices')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', license.id);

  if (countError) {
    throw countError;
  }

  if ((count || 0) >= license.max_devices) {
    return { success: false, reason: 'device_limit_reached' };
  }

  const { error: insertError } = await supabaseAdmin.from('devices').insert({
    license_id: license.id,
    hwid_hash: hwidHash,
    device_name: deviceName || 'Unknown device',
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: true, reason: 'known_device' };
    }

    throw insertError;
  }

  return { success: true, reason: 'new_device_bound' };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = validateBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const { licenseKey, hwidHash, deviceName } = parsed.data;
    const normalizedLicenseKey = normalizeLicenseKey(licenseKey);
    if (!normalizedLicenseKey) {
      return NextResponse.json(
        { success: false, message: 'Invalid license format' },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);
    const rateLimitCheck = await checkRateLimit(normalizedLicenseKey, clientIp);

    if (rateLimitCheck.limited) {
      await writeAuthLog(normalizedLicenseKey, hwidHash, false, rateLimitCheck.reason, clientIp);

      const mappedLimitResponse = reasonResponseMap[rateLimitCheck.reason];
      return NextResponse.json(
        { success: false, message: mappedLimitResponse.message },
        {
          status: mappedLimitResponse.status,
          headers: {
            'Retry-After': String(rateLimitCheck.retryAfter),
          },
        }
      );
    }

    let decision = await bindDeviceWithRpc(normalizedLicenseKey, hwidHash, deviceName);

    if (decision.error) {
      if (!isMissingRpcError(decision.error)) {
        throw decision.error;
      }

      decision = await legacyBindDevice(normalizedLicenseKey, hwidHash, deviceName);
    }

    const mappedResponse = reasonResponseMap[decision.reason] || {
      status: decision.success ? 200 : 403,
      message: decision.success ? 'Authorized' : 'Access denied',
    };

    await writeAuthLog(normalizedLicenseKey, hwidHash, decision.success, decision.reason, clientIp);

    return NextResponse.json(
      { success: decision.success, message: mappedResponse.message },
      { status: mappedResponse.status }
    );
  } catch (error) {
    console.error('Validation route error:', error);

    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
