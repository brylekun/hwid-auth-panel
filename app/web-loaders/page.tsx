import {
  getAdminAuditLogs,
  getAuthLogs,
  getDevices,
  getLicenses,
  getWebLoaders,
} from '@/lib/dashboardData';
import DashboardShell from '../components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function WebLoadersPage() {
  const [licenses, devices, logs, adminAuditLogs, webLoaders] = await Promise.all([
    getLicenses(),
    getDevices(),
    getAuthLogs(),
    getAdminAuditLogs(),
    getWebLoaders(),
  ]);

  return (
    <DashboardShell
      initialLicenses={licenses}
      initialDevices={devices}
      initialLogs={logs}
      initialAdminAuditLogs={adminAuditLogs}
      initialWebLoaders={webLoaders}
      view="web-loaders"
    />
  );
}
