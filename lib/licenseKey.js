const GROUP_LENGTH = 5;
const GROUP_COUNT = 4;
const TOTAL_LENGTH = GROUP_LENGTH * GROUP_COUNT;

export function normalizeLicenseKey(input) {
  const raw = String(input || '');
  const packed = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (packed.length !== TOTAL_LENGTH) {
    return null;
  }

  const groups = [];
  for (let i = 0; i < packed.length; i += GROUP_LENGTH) {
    groups.push(packed.slice(i, i + GROUP_LENGTH));
  }

  return groups.join('-');
}
