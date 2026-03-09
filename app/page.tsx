import { getAuthLogs, getDevices, getLicenses } from '@/lib/dashboardData';
import CreateLicenseForm from './components/CreateLicenseForm';
import ResetDeviceButton from './components/ResetDeviceButton';

type LicenseRow = {
  id: string;
  license_key: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
  created_at: string;
};

type DeviceRow = {
  id: string;
  hwid_hash: string;
  device_name: string | null;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
};

type AuthLogRow = {
  id: string;
  license_key: string;
  hwid_hash: string;
  result: string;
  reason: string;
  created_at: string;
};

export default async function HomePage() {
  const [licenses, devices, logs] = await Promise.all([
    getLicenses(),
    getDevices(),
    getAuthLogs(),
  ]);

  return (
    <main style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '24px' }}>HWID Authentication Web Panel</h1>

      <CreateLicenseForm />

      <section style={{ marginBottom: '32px' }}>
        <h2>Overview</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={cardStyle}>
            <strong>Total Licenses</strong>
            <div style={bigNumber}>{licenses.length}</div>
          </div>
          <div style={cardStyle}>
            <strong>Total Devices</strong>
            <div style={bigNumber}>{devices.length}</div>
          </div>
          <div style={cardStyle}>
            <strong>Recent Logs</strong>
            <div style={bigNumber}>{logs.length}</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2>Licenses</h2>
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>License Key</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Max Devices</th>
                <th style={thStyle}>Expires At</th>
                <th style={thStyle}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license: LicenseRow) => (
                <tr key={license.id}>
                  <td style={tdStyle}>{license.license_key}</td>
                  <td style={tdStyle}>{license.status}</td>
                  <td style={tdStyle}>{license.max_devices}</td>
                  <td style={tdStyle}>{license.expires_at || 'Never'}</td>
                  <td style={tdStyle}>{license.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2>Devices</h2>
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>HWID Hash</th>
                <th style={thStyle}>Device Name</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>First Seen</th>
                <th style={thStyle}>Last Seen</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device: DeviceRow) => (
                <tr key={device.id}>
                  <td style={tdStyle}>{device.hwid_hash}</td>
                  <td style={tdStyle}>{device.device_name || 'Unknown'}</td>
                  <td style={tdStyle}>{device.status}</td>
                  <td style={tdStyle}>{device.first_seen_at}</td>
                  <td style={tdStyle}>{device.last_seen_at}</td>
                  <td style={tdStyle}>
                    <ResetDeviceButton deviceId={device.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Recent Auth Logs</h2>
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>License Key</th>
                <th style={thStyle}>HWID Hash</th>
                <th style={thStyle}>Result</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: AuthLogRow) => (
                <tr key={log.id}>
                  <td style={tdStyle}>{log.license_key}</td>
                  <td style={tdStyle}>{log.hwid_hash}</td>
                  <td style={tdStyle}>{log.result}</td>
                  <td style={tdStyle}>{log.reason}</td>
                  <td style={tdStyle}>{log.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const cardStyle = {
  border: '1px solid #333',
  borderRadius: '10px',
  padding: '16px',
  minWidth: '180px',
  background: '#111',
};

const bigNumber = {
  fontSize: '28px',
  marginTop: '10px',
};

const tableWrap = {
  overflowX: 'auto' as const,
  border: '1px solid #333',
  borderRadius: '10px',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const thStyle = {
  textAlign: 'left' as const,
  borderBottom: '1px solid #333',
  padding: '12px',
  background: '#161616',
};

const tdStyle = {
  borderBottom: '1px solid #222',
  padding: '12px',
};
