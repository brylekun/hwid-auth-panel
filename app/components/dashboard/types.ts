export type LicenseRow = {
  id: string;
  license_key: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
  created_at: string;
};

export type DeviceRow = {
  id: string;
  license_id: string | null;
  hwid_hash: string;
  device_name: string | null;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
};

export type AuthLogRow = {
  id: string;
  license_key: string;
  hwid_hash: string;
  result: string;
  reason: string;
  created_at: string;
};

export type AdminAuditLogRow = {
  id: number;
  admin_username: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  target_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WebLoaderRow = {
  id: string;
  name: string;
  slug: string;
  download_url: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};
