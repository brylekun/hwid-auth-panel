const LOADER_SLUG_REGEX = /^[a-z0-9][a-z0-9_-]*$/;

export function normalizeLoaderSlug(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 64) {
    return null;
  }

  return LOADER_SLUG_REGEX.test(normalized) ? normalized : null;
}
