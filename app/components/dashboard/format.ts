export const MANILA_TIMEZONE = 'Asia/Manila';

const manilaDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIMEZONE,
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

const manilaDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MANILA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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

  return manilaDateTimeFormatter.format(parsed);
}

export function toManilaDayKey(value: string | number | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return manilaDayFormatter.format(parsed);
}

export function getTodayManilaDayKey(referenceTime = Date.now()) {
  return toManilaDayKey(referenceTime);
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
