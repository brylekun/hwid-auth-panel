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

export function normalize(value: string) {
  return value.trim().toLowerCase();
}
