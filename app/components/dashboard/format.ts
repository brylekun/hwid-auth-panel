export const MANILA_TIMEZONE = 'Asia/Manila';

function parseDateValue(value: string | number | Date) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  const text = String(value).trim();

  // Supabase may return UTC timestamps without timezone marker.
  // Interpret timezone-less date-times as UTC to avoid +8h drift in Manila.
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(text)) {
    return new Date(text.replace(' ', 'T') + 'Z');
  }

  return new Date(text);
}

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

  const parsed = parseDateValue(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return manilaDateTimeFormatter.format(parsed);
}

export function toManilaDayKey(value: string | number | Date) {
  const parsed = parseDateValue(value);
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
    return '<1 min';
  }

  if (absMs < hour) {
    const minutes = Math.floor(absMs / minute);
    return `${minutes} min`;
  }

  if (absMs < day) {
    const hours = Math.floor(absMs / hour);
    const minutes = Math.floor((absMs % hour) / minute);
    if (minutes === 0) {
      return `${hours} hr`;
    }
    return `${hours} hr ${minutes} min`;
  }

  const days = Math.floor(absMs / day);
  const hours = Math.floor((absMs % day) / hour);
  if (hours === 0) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'} ${hours} hr`;
}

export function formatLicenseDuration(expiresAt: string | null, createdAt: string | null) {
  if (!expiresAt) {
    return 'Never';
  }

  const expiresMs = parseDateValue(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) {
    return expiresAt;
  }

  const createdMs = createdAt ? parseDateValue(createdAt).getTime() : Number.NaN;
  if (Number.isNaN(createdMs)) {
    return 'Unknown';
  }

  return formatDurationLabel(expiresMs - createdMs);
}

export function getLicenseExpiryInfo(
  expiresAt: string | null,
  referenceTime = Date.now(),
  pendingActivation = false
) {
  if (!expiresAt) {
    return {
      state: 'never' as const,
      label: 'No expiration',
      dateLabel: 'Never',
    };
  }

  const expiresMs = parseDateValue(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) {
    return {
      state: 'invalid' as const,
      label: 'Invalid expiration date',
      dateLabel: expiresAt,
    };
  }

  if (pendingActivation) {
    return {
      state: 'pending' as const,
      label: 'Starts on first login',
      dateLabel: formatDateTime(expiresAt),
    };
  }

  if (expiresMs <= referenceTime) {
    return {
      state: 'expired' as const,
      label: `Expired ${formatDurationLabel(referenceTime - expiresMs)} ago`,
      dateLabel: formatDateTime(expiresAt),
    };
  }

  return {
    state: 'active' as const,
    label: `Expires in ${formatDurationLabel(expiresMs - referenceTime)}`,
    dateLabel: formatDateTime(expiresAt),
  };
}

export function normalize(value: string) {
  return value.trim().toLowerCase();
}
