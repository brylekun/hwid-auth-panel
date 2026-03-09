import { getAdminAuditLogs, getAuthLogs, getDevices, getLicenses } from '@/lib/dashboardData';
import DashboardShell from '../components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function LicensesPage() {
  const [licenses, devices, logs, adminAuditLogs] = await Promise.all([
    getLicenses(),
    getDevices(),
    getAuthLogs(),
    getAdminAuditLogs(),
  ]);

  return (
    <DashboardShell
      initialLicenses={licenses}
      initialDevices={devices}
      initialLogs={logs}
      initialAdminAuditLogs={adminAuditLogs}
      view="licenses"
    />
  );
}
