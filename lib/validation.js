import { z } from 'zod';

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

    return !Number.isNaN(new Date(value).getTime());
  }, 'expiresAt must be a valid date')
  .transform((value) => {
    if (value == null || value === '') {
      return null;
    }

    return new Date(value).toISOString();
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
