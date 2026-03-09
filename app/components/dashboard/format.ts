export function maskValue(value: string, show: boolean, visible = 4) {
  if (show) {
    return value;
  }

  if (!value || value.length <= visible) {
    return '****';
  }

  return `${'*'.repeat(Math.max(4, value.length - visible))}${value.slice(-visible)}`;
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return 'Never';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function formatDurationLabel(ms: number) {
  const absMs = Math.max(0, Math.trunc(ms));
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) {
    return '0 min';
  }

  if (absMs < hour) {
    const minutes = Math.round(absMs / minute);
    return `${minutes} min`;
  }

  if (absMs < day) {
    const hours = Math.round(absMs / hour);
    return `${hours} hr`;
  }

  const days = Math.round(absMs / day);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function formatLicenseDuration(expiresAt: string | null, createdAt: string | null) {
  if (!expiresAt) {
    return 'Never';
  }

  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) {
    return expiresAt;
  }

  const createdMs = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  if (Number.isNaN(createdMs)) {
    return 'Unknown';
  }

  return formatDurationLabel(expiresMs - createdMs);
}

export function normalize(value: string) {
  return value.trim().toLowerCase();
}
