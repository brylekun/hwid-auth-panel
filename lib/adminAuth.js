function safeCompare(a, b) {
  return (a || '') === (b || '');
}

function base64Decode(value) {
  try {
    if (typeof atob === 'function') {
      return atob(value);
    }
  } catch {
    return null;
  }

  return null;
}

function decodeBasicAuthHeader(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Basic ')) {
    return null;
  }

  const encoded = authorizationHeader.slice(6).trim();
  const decoded = base64Decode(encoded);

  if (!decoded) {
    return null;
  }

  const separatorIndex = decoded.indexOf(':');

  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

export function isAdminAuthConfigured() {
  return Boolean(process.env.ADMIN_PANEL_PASSWORD);
}

export function isAdminBasicAuthValid(headers) {
  const expectedUsername = process.env.ADMIN_PANEL_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_PANEL_PASSWORD;

  if (!expectedPassword) {
    return false;
  }

  const credentials = decodeBasicAuthHeader(headers.get('authorization'));
  if (!credentials) {
    return false;
  }

  return (
    safeCompare(credentials.username, expectedUsername) &&
    safeCompare(credentials.password, expectedPassword)
  );
}

export function basicAuthChallengeHeaders() {
  return {
    'WWW-Authenticate': 'Basic realm="HWID Panel", charset="UTF-8"',
  };
}
