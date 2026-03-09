import { getAuthLogs, getDevices, getLicenses } from '@/lib/dashboardData';
import DashboardShell from './components/dashboard/DashboardShell';

export default async function HomePage() {
  const [licenses, devices, logs] = await Promise.all([
    getLicenses(),
    getDevices(),
    getAuthLogs(),
  ]);

  return <DashboardShell initialLicenses={licenses} initialDevices={devices} initialLogs={logs} />;
}
