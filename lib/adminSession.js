const ADMIN_SESSION_COOKIE = 'admin_session';
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

function safeCompare(a, b) {
  return (a || '') === (b || '');
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  const normalized = `${base64}${padding}`;

  const binary = typeof atob === 'function'
    ? atob(normalized)
    : Buffer.from(normalized, 'base64').toString('binary');

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PANEL_PASSWORD || '';
}

async function getHmacKey() {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export function isAdminAuthConfigured() {
  return Boolean(process.env.ADMIN_PANEL_PASSWORD);
}

export function isAdminCredentialValid(username, password) {
  const expectedUsername = process.env.ADMIN_PANEL_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_PANEL_PASSWORD || '';

  return safeCompare(username, expectedUsername) && safeCompare(password, expectedPassword);
}

export async function createAdminSessionToken(username) {
  const key = await getHmacKey();
  if (!key) {
    throw new Error('Missing admin session secret');
  }

  const payload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE,
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadEncoded = toBase64Url(payloadBytes);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadEncoded)
  );

  return `${payloadEncoded}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(token) {
  const payload = await getValidSessionPayload(token);
  return Boolean(payload);
}

async function getValidSessionPayload(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const [payloadEncoded, signatureEncoded] = token.split('.');
  if (!payloadEncoded || !signatureEncoded) {
    return null;
  }

  const key = await getHmacKey();
  if (!key) {
    return null;
  }

  const validSignature = await crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(signatureEncoded),
    new TextEncoder().encode(payloadEncoded)
  );

  if (!validSignature) {
    return null;
  }

  try {
    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadEncoded));
    const payload = JSON.parse(payloadJson);

    if (!payload?.u || typeof payload?.exp !== 'number') {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    const expectedUsername = process.env.ADMIN_PANEL_USERNAME || 'admin';
    return safeCompare(payload.u, expectedUsername) ? payload : null;
  } catch {
    return null;
  }
}

export async function isAdminSessionFromRequest(req) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export async function getAdminUsernameFromRequest(req) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const payload = await getValidSessionPayload(token);
  return payload?.u || null;
}

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE };
