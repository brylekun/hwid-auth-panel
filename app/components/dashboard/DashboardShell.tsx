'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AdminLogoutButton from '../AdminLogoutButton';
import AdminAuditLogsTable from './AdminAuditLogsTable';
import AuthLogsTable from './AuthLogsTable';
import DevicesTable from './DevicesTable';
import LicensesTable from './LicensesTable';
import OverviewCards from './OverviewCards';
import TrendWidgets from './TrendWidgets';
import styles from './dashboard.module.css';
import type { AdminAuditLogRow, AuthLogRow, DeviceRow, LicenseRow } from './types';

type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error';
};

type Props = {
  initialLicenses: LicenseRow[];
  initialDevices: DeviceRow[];
  initialLogs: AuthLogRow[];
  initialAdminAuditLogs: AdminAuditLogRow[];
};

export default function DashboardShell({
  initialLicenses,
  initialDevices,
  initialLogs,
  initialAdminAuditLogs,
}: Props) {
  const [licenses, setLicenses] = useState(initialLicenses);
  const [devices, setDevices] = useState(initialDevices);
  const [logs] = useState(initialLogs);
  const [adminAuditLogs] = useState(initialAdminAuditLogs);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(message: string, type: 'success' | 'error' = 'success') {
    const toastId = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id: toastId, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== toastId));
    }, 3000);
  }

  function handleDeviceReset(deviceId: string) {
    setDevices((prev) => prev.filter((device) => device.id !== deviceId));
  }

  function handleLicenseDeleted(licenseId: string) {
    setLicenses((prev) => prev.filter((license) => license.id !== licenseId));
  }

  function handleLicenseUpdated(updated: LicenseRow) {
    setLicenses((prev) => prev.map((license) => (license.id === updated.id ? updated : license)));
  }

  const totals = useMemo(() => {
    return {
      licenses: licenses.length,
      devices: devices.length,
      logs: logs.length,
      adminLogs: adminAuditLogs.length,
    };
  }, [licenses.length, devices.length, logs.length, adminAuditLogs.length]);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Admin Workspace</p>
          <h1 className={styles.heroTitle}>ThunderTool HWID Panel</h1>
          <p className={styles.heroSubtitle}>Manage licenses, device bindings, and validation activity.</p>
          <div className={styles.heroMeta}>
            <span className={styles.metaPill}>Session Protected</span>
            <span className={styles.metaPill}>Live Inventory: {totals.devices}</span>
          </div>
        </div>
        <div className={styles.toolbar}>
          <Link href="/licenses/create" className={styles.btnLink}>
            Create License
          </Link>
          <AdminLogoutButton />
        </div>
      </header>

      <OverviewCards
        totalLicenses={totals.licenses}
        totalDevices={totals.devices}
        recentLogs={totals.logs}
        adminLogs={totals.adminLogs}
      />

      <TrendWidgets licenses={licenses} logs={logs} />

      <LicensesTable
        licenses={licenses}
        onLicenseDeleted={handleLicenseDeleted}
        onLicenseUpdated={handleLicenseUpdated}
        pushToast={pushToast}
      />

      <DevicesTable
        devices={devices}
        onDeviceReset={handleDeviceReset}
        pushToast={pushToast}
      />

      <AuthLogsTable logs={logs} />
      <AdminAuditLogsTable logs={adminAuditLogs} showSensitive={false} />

      <div className={styles.toastWrap}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : ''}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}
