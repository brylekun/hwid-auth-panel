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
