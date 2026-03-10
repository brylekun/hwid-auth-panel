import { z } from 'zod';

const MANILA_UTC_OFFSET_MINUTES = 8 * 60;

function parseExpiryToIso(value) {
  if (value == null || value === '') {
    return null;
  }

  const text = String(value).trim();

  // If timezone is explicitly provided, trust it.
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  // datetime-local values have no timezone, so interpret them as Asia/Manila.
  const localMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    const utcMs =
      Date.UTC(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss || '0')
      ) - MANILA_UTC_OFFSET_MINUTES * 60 * 1000;
    return new Date(utcMs).toISOString();
  }

  // Fallback for other valid date formats.
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const licenseKeySchema = z
  .string()
  .trim()
  .min(1, 'licenseKey is required')
  .max(128, 'licenseKey is too long');

const hwidSchema = z
  .string()
  .trim()
  .min(1, 'hwidHash is required')
  .max(256, 'hwidHash is too long');

const deviceNameSchema = z
  .string()
  .trim()
  .min(1, 'deviceName cannot be empty')
  .max(120, 'deviceName is too long')
  .optional();

const optionalExpirySchema = z
  .union([z.string().trim(), z.null(), z.undefined()])
  .refine((value) => {
    if (value == null || value === '') {
      return true;
    }

    return parseExpiryToIso(value) !== null;
  }, 'expiresAt must be a valid date')
  .transform((value) => {
    if (value == null || value === '') {
      return null;
    }

    return parseExpiryToIso(value);
  });

export const createLicenseBodySchema = z.object({
  licenseKey: licenseKeySchema,
  maxDevices: z.coerce.number().int().min(1).max(100).default(1),
  expiresAt: optionalExpirySchema,
});

export const resetDeviceBodySchema = z.object({
  deviceId: z.string().trim().min(1, 'deviceId is required').max(64),
});

export const validateBodySchema = z.object({
  licenseKey: licenseKeySchema,
  hwidHash: hwidSchema,
  deviceName: deviceNameSchema,
});

export const adminLoginBodySchema = z.object({
  username: z.string().trim().min(1, 'username is required').max(64),
  password: z.string().min(1, 'password is required').max(256),
});

const licenseIdSchema = z.string().trim().min(1, 'licenseId is required').max(64);
const webLoaderIdSchema = z.string().trim().min(1, 'loaderId is required').max(64);

const webLoaderNameSchema = z
  .string()
  .trim()
  .min(1, 'name is required')
  .max(120, 'name is too long');

const webLoaderSlugSchema = z
  .string()
  .trim()
  .min(1, 'loaderSlug is required')
  .max(64, 'loaderSlug is too long')
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'loaderSlug may only contain letters, numbers, - and _');

const webLoaderDownloadUrlSchema = z
  .string()
  .trim()
  .min(1, 'downloadUrl is required')
  .max(2048, 'downloadUrl is too long')
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'downloadUrl must be a valid http(s) URL');

const webLoaderStorageBucketSchema = z
  .string()
  .trim()
  .min(3, 'storageBucket is too short')
  .max(128, 'storageBucket is too long')
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'storageBucket may only contain lowercase letters, numbers, ., - and _');

const webLoaderStoragePathSchema = z
  .string()
  .trim()
  .min(3, 'storagePath is too short')
  .max(1024, 'storagePath is too long')
  .refine((value) => !value.startsWith('/'), 'storagePath must not start with /');

const webLoaderSignedUrlTtlSchema = z.coerce
  .number()
  .int()
  .min(60, 'signedUrlTtlSeconds must be at least 60')
  .max(3600, 'signedUrlTtlSeconds must be at most 3600');

const webLoaderExpectedSha256Schema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-f0-9]{64}$/, 'expectedSha256 must be a 64-char lowercase hex SHA-256');

export const deleteLicenseBodySchema = z.object({
  licenseId: licenseIdSchema,
});

export const updateLicenseBodySchema = z
  .object({
    licenseId: licenseIdSchema,
    licenseKey: z.string().trim().min(1).max(128).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    expiresAt: z
      .union([z.string().trim(), z.null()])
      .refine((value) => {
        if (value == null || value === '') {
          return true;
        }

        return parseExpiryToIso(value) !== null;
      }, 'expiresAt must be a valid date')
      .transform((value) => {
        if (value == null || value === '') {
          return null;
        }

        return parseExpiryToIso(value);
      })
      .optional(),
  })
  .refine((value) => Boolean(value.licenseKey || value.status || value.expiresAt !== undefined), {
    message: 'Provide at least one update field',
  });

export const createWebLoaderBodySchema = z.object({
  name: webLoaderNameSchema,
  loaderSlug: webLoaderSlugSchema,
  downloadUrl: webLoaderDownloadUrlSchema,
  storageBucket: webLoaderStorageBucketSchema.optional(),
  storagePath: webLoaderStoragePathSchema.optional(),
  signedUrlTtlSeconds: webLoaderSignedUrlTtlSchema.optional(),
  expectedSha256: webLoaderExpectedSha256Schema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).refine(
  (value) =>
    (value.storageBucket && value.storagePath) || (!value.storageBucket && !value.storagePath),
  {
    message: 'storageBucket and storagePath must be provided together',
    path: ['storageBucket'],
  }
);

export const updateWebLoaderBodySchema = z
  .object({
    loaderId: webLoaderIdSchema,
    name: webLoaderNameSchema.optional(),
    loaderSlug: webLoaderSlugSchema.optional(),
    downloadUrl: webLoaderDownloadUrlSchema.optional(),
    storageBucket: z.union([webLoaderStorageBucketSchema, z.null()]).optional(),
    storagePath: z.union([webLoaderStoragePathSchema, z.null()]).optional(),
    signedUrlTtlSeconds: webLoaderSignedUrlTtlSchema.optional(),
    expectedSha256: z.union([webLoaderExpectedSha256Schema, z.null()]).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.name ||
          value.loaderSlug ||
          value.downloadUrl ||
          value.status ||
          value.storageBucket !== undefined ||
          value.storagePath !== undefined ||
          value.signedUrlTtlSeconds ||
          value.expectedSha256 !== undefined
      ),
    {
      message: 'Provide at least one update field',
    }
  )
  .refine((value) => {
    const bucketProvided = Object.prototype.hasOwnProperty.call(value, 'storageBucket');
    const pathProvided = Object.prototype.hasOwnProperty.call(value, 'storagePath');

    if (!bucketProvided && !pathProvided) {
      return true;
    }

    if (!bucketProvided || !pathProvided) {
      return false;
    }

    const bucket = value.storageBucket;
    const path = value.storagePath;

    return (bucket === null && path === null) || (Boolean(bucket) && Boolean(path));
  }, {
    message: 'storageBucket and storagePath must be updated together',
    path: ['storageBucket'],
  });

export const deleteWebLoaderBodySchema = z.object({
  loaderId: webLoaderIdSchema,
});
