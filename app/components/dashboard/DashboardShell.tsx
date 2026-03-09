'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AdminLogoutButton from '../AdminLogoutButton';
import AuthLogsTable from './AuthLogsTable';
import DevicesTable from './DevicesTable';
import LicensesTable from './LicensesTable';
import OverviewCards from './OverviewCards';
import TrendWidgets from './TrendWidgets';
import styles from './dashboard.module.css';
import type { AuthLogRow, DeviceRow, LicenseRow } from './types';

type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error';
};

type Props = {
  initialLicenses: LicenseRow[];
  initialDevices: DeviceRow[];
  initialLogs: AuthLogRow[];
};

export default function DashboardShell({ initialLicenses, initialDevices, initialLogs }: Props) {
  const [licenses] = useState(initialLicenses);
  const [devices, setDevices] = useState(initialDevices);
  const [logs] = useState(initialLogs);
  const [showSensitive, setShowSensitive] = useState(false);
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

  const totals = useMemo(() => {
    return {
      licenses: licenses.length,
      devices: devices.length,
      logs: logs.length,
    };
  }, [licenses.length, devices.length, logs.length]);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Admin Workspace</p>
          <h1 className={styles.heroTitle}>HWID Control Center</h1>
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
          <button className={styles.btnGhost} onClick={() => setShowSensitive((prev) => !prev)}>
            {showSensitive ? 'Hide Sensitive' : 'Show Sensitive'}
          </button>
          <AdminLogoutButton />
        </div>
      </header>

      <OverviewCards
        totalLicenses={totals.licenses}
        totalDevices={totals.devices}
        recentLogs={totals.logs}
      />

      <TrendWidgets licenses={licenses} logs={logs} />

      <LicensesTable licenses={licenses} showSensitive={showSensitive} />

      <DevicesTable
        devices={devices}
        onDeviceReset={handleDeviceReset}
        pushToast={pushToast}
        showSensitive={showSensitive}
      />

      <AuthLogsTable logs={logs} showSensitive={showSensitive} />

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
