'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AdminLogoutButton from '../AdminLogoutButton';
import AdminAuditLogsTable from './AdminAuditLogsTable';
import AuthLogsTable from './AuthLogsTable';
import CreateLicensePageForm from '@/app/licenses/create/CreateLicensePageForm';
import DevicesTable from './DevicesTable';
import LicensesTable from './LicensesTable';
import OverviewCards from './OverviewCards';
import TrendWidgets from './TrendWidgets';
import styles from './dashboard.module.css';
import { getTodayManilaDayKey, toManilaDayKey } from './format';
import type { AdminAuditLogRow, AuthLogRow, DeviceRow, LicenseRow } from './types';

type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error';
};

type QuickFilter =
  | 'all'
  | 'active'
  | 'inactive'
  | 'denied'
  | 'rate_limited'
  | 'today'
  | 'last_24h';

type Props = {
  initialLicenses: LicenseRow[];
  initialDevices: DeviceRow[];
  initialLogs: AuthLogRow[];
  initialAdminAuditLogs: AdminAuditLogRow[];
  view?: 'home' | 'licenses' | 'devices' | 'create-license';
};

const navLinks = [
  { href: '/', label: 'Overview', view: 'home' },
  { href: '/licenses', label: 'Licenses', view: 'licenses' },
  { href: '/devices', label: 'Devices', view: 'devices' },
  { href: '/licenses/create', label: 'Create License', view: 'create-license' },
] as const;

export default function DashboardShell({
  initialLicenses,
  initialDevices,
  initialLogs,
  initialAdminAuditLogs,
  view = 'home',
}: Props) {
  const [licenses, setLicenses] = useState(initialLicenses);
  const [devices, setDevices] = useState(initialDevices);
  const [logs] = useState(initialLogs);
  const [adminAuditLogs] = useState(initialAdminAuditLogs);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [referenceTime] = useState(() => Date.now());
  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(referenceTime)),
    [referenceTime]
  );

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

  const filteredData = useMemo(() => {
    const manilaTodayKey = getTodayManilaDayKey(referenceTime);

    const inLast24h = (value: string) => new Date(value).getTime() >= referenceTime - 24 * 60 * 60 * 1000;
    const inToday = (value: string) => toManilaDayKey(value) === manilaTodayKey;

    if (quickFilter === 'all') {
      return { licenses, devices, logs, adminAuditLogs };
    }

    if (quickFilter === 'active') {
      return {
        licenses: licenses.filter((item) => item.status === 'active'),
        devices: devices.filter((item) => item.status === 'active'),
        logs,
        adminAuditLogs,
      };
    }

    if (quickFilter === 'inactive') {
      return {
        licenses: licenses.filter((item) => item.status !== 'active'),
        devices: devices.filter((item) => item.status !== 'active'),
        logs,
        adminAuditLogs,
      };
    }

    if (quickFilter === 'denied') {
      return {
        licenses,
        devices,
        logs: logs.filter((item) => item.result === 'denied'),
        adminAuditLogs,
      };
    }

    if (quickFilter === 'rate_limited') {
      return {
        licenses,
        devices,
        logs: logs.filter((item) => item.reason?.startsWith('rate_limited')),
        adminAuditLogs,
      };
    }

    if (quickFilter === 'today') {
      return {
        licenses: licenses.filter((item) => inToday(item.created_at)),
        devices: devices.filter((item) => inToday(item.first_seen_at || item.last_seen_at)),
        logs: logs.filter((item) => inToday(item.created_at)),
        adminAuditLogs: adminAuditLogs.filter((item) => inToday(item.created_at)),
      };
    }

    return {
      licenses: licenses.filter((item) => inLast24h(item.created_at)),
      devices: devices.filter((item) => inLast24h(item.first_seen_at || item.last_seen_at)),
      logs: logs.filter((item) => inLast24h(item.created_at)),
      adminAuditLogs: adminAuditLogs.filter((item) => inLast24h(item.created_at)),
    };
  }, [quickFilter, licenses, devices, logs, adminAuditLogs, referenceTime]);

  return (
    <main className={styles.page}>
      <div className={styles.appShell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarProfile}>
            <div className={styles.sidebarAvatar}>TT</div>
            <div>
              <p className={styles.sidebarProfileTitle}>ThunderTool Panel</p>
              <p suppressHydrationWarning className={styles.sidebarProfileMeta}>{generatedAt}</p>
            </div>
          </div>

          <div className={styles.sidebarGroup}>
            <p className={styles.sidebarTitle}>Operations</p>
            {navLinks.slice(0, 3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.sideLink} ${link.view === view ? styles.sideLinkActive : ''}`}
              >
                <span className={styles.sideLinkIcon} aria-hidden="true" />
                <span className={styles.sideLinkLabel}>{link.label}</span>
              </Link>
            ))}
          </div>

          <div className={styles.sidebarGroup}>
            <p className={styles.sidebarTitle}>Management</p>
            {navLinks.slice(3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.sideLink} ${link.view === view ? styles.sideLinkActive : ''}`}
              >
                <span className={styles.sideLinkIcon} aria-hidden="true" />
                <span className={styles.sideLinkLabel}>{link.label}</span>
              </Link>
            ))}
          </div>

          <div className={styles.sidebarSpacer} />
          <div className={styles.sidebarFooter}>
            <p className={styles.sidebarFooterTitle}>Admin</p>
            <p className={styles.sidebarFooterMeta}>HWID Administrator</p>
            <AdminLogoutButton className={styles.sidebarLogoutBtn} />
          </div>
        </aside>

        <div className={styles.mainColumn}>
          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>Admin Workspace</p>
              <h1 className={styles.heroTitle}>
                {view === 'licenses'
                  ? 'Licenses'
                  : view === 'devices'
                    ? 'Devices'
                    : view === 'create-license'
                      ? 'Create License'
                    : 'ThunderTool HWID Panel'}
              </h1>
              <p className={styles.heroSubtitle}>
                {view === 'licenses'
                  ? 'Manage keys, status, expiration, and license lifecycle controls.'
                  : view === 'devices'
                    ? 'Monitor and manage bound devices and their hardware identifiers.'
                    : view === 'create-license'
                      ? 'Generate and configure new license keys with expiration controls.'
                    : 'Manage licenses, device bindings, and validation activity.'}
              </p>
              <div className={styles.heroMeta}>
                <span className={styles.metaPill}>Session Protected</span>
                <span className={styles.metaPill}>Live Inventory: {totals.devices}</span>
              </div>
            </div>
          </header>

          <section className={styles.quickFilters}>
            <button className={`${styles.filterChip} ${quickFilter === 'all' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('all')}>All</button>
            <button className={`${styles.filterChip} ${quickFilter === 'active' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('active')}>Active</button>
            <button className={`${styles.filterChip} ${quickFilter === 'inactive' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('inactive')}>Inactive</button>
            <button className={`${styles.filterChip} ${quickFilter === 'denied' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('denied')}>Denied</button>
            <button className={`${styles.filterChip} ${quickFilter === 'rate_limited' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('rate_limited')}>Rate-limited</button>
            <button className={`${styles.filterChip} ${quickFilter === 'today' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('today')}>Today</button>
            <button className={`${styles.filterChip} ${quickFilter === 'last_24h' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('last_24h')}>Last 24h</button>
          </section>

          {view === 'licenses' ? (
            <LicensesTable
              licenses={filteredData.licenses}
              onLicenseDeleted={handleLicenseDeleted}
              onLicenseUpdated={handleLicenseUpdated}
              pushToast={pushToast}
            />
          ) : null}

          {view === 'devices' ? (
            <DevicesTable
              devices={filteredData.devices}
              onDeviceReset={handleDeviceReset}
              pushToast={pushToast}
            />
          ) : null}

          {view === 'create-license' ? (
            <CreateLicensePageForm embedded />
          ) : null}

          {view === 'home' ? (
            <>
              <OverviewCards
                totalLicenses={totals.licenses}
                totalDevices={totals.devices}
                recentLogs={totals.logs}
                adminLogs={totals.adminLogs}
              />
              <TrendWidgets
                licenses={filteredData.licenses}
                logs={filteredData.logs}
                referenceTime={referenceTime}
              />
              <AuthLogsTable logs={filteredData.logs} />
              <AdminAuditLogsTable logs={filteredData.adminAuditLogs} />
            </>
          ) : null}
        </div>
      </div>

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
