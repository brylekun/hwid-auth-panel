'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
};

const sectionLinks = [
  { id: 'overview', label: 'Overview' },
  { id: 'trends', label: 'Performance Pulse' },
  { id: 'licenses', label: 'Licenses' },
  { id: 'devices', label: 'Devices' },
  { id: 'auth-logs', label: 'Recent Auth Logs' },
  { id: 'admin-logs', label: 'Admin Audit Logs' },
] as const;

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
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [referenceTime] = useState(() => Date.now());
  const [activeSection, setActiveSection] = useState('overview');

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
    const startOfToday = new Date(referenceTime);
    startOfToday.setHours(0, 0, 0, 0);

    const inLast24h = (value: string) => new Date(value).getTime() >= referenceTime - 24 * 60 * 60 * 1000;
    const inToday = (value: string) => new Date(value).getTime() >= startOfToday.getTime();

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

  const activeSectionMeta = useMemo(() => {
    const index = sectionLinks.findIndex((item) => item.id === activeSection);
    const safeIndex = index === -1 ? 0 : index;
    const progressPercent = ((safeIndex + 1) / sectionLinks.length) * 100;

    return {
      label: sectionLinks[safeIndex].label,
      current: safeIndex + 1,
      total: sectionLinks.length,
      progressPercent,
    };
  }, [activeSection]);

  useEffect(() => {
    const elements = sectionLinks
      .map((item) => item.id)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.1, 0.25, 0.5],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function jumpToSection(sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(sectionId);
  }

  return (
    <main className={styles.page}>
      <div className={styles.appShell}>
        <aside className={styles.sidebar}>
          <p className={styles.sidebarTitle}>Navigation</p>
          {sectionLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`${styles.sideLink} ${activeSection === link.id ? styles.sideLinkActive : ''}`}
            >
              {link.label}
            </a>
          ))}
        </aside>

        <div className={styles.mainColumn}>
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

          <section className={styles.quickFilters}>
            <button className={`${styles.filterChip} ${quickFilter === 'all' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('all')}>All</button>
            <button className={`${styles.filterChip} ${quickFilter === 'active' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('active')}>Active</button>
            <button className={`${styles.filterChip} ${quickFilter === 'inactive' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('inactive')}>Inactive</button>
            <button className={`${styles.filterChip} ${quickFilter === 'denied' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('denied')}>Denied</button>
            <button className={`${styles.filterChip} ${quickFilter === 'rate_limited' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('rate_limited')}>Rate-limited</button>
            <button className={`${styles.filterChip} ${quickFilter === 'today' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('today')}>Today</button>
            <button className={`${styles.filterChip} ${quickFilter === 'last_24h' ? styles.filterChipActive : ''}`} onClick={() => setQuickFilter('last_24h')}>Last 24h</button>
          </section>

          <section className={styles.mobileNav}>
            <label htmlFor="mobile-section-nav" className={styles.mobileNavLabel}>
              Jump to section
            </label>
            <select
              id="mobile-section-nav"
              className={styles.mobileNavSelect}
              value={activeSection}
              onChange={(event) => jumpToSection(event.target.value)}
            >
              {sectionLinks.map((link) => (
                <option key={link.id} value={link.id}>
                  {link.label}
                </option>
              ))}
            </select>
            <div className={styles.mobileIndicator}>
              <div className={styles.mobileIndicatorHead}>
                <span className={styles.mobileIndicatorText}>Now viewing: {activeSectionMeta.label}</span>
                <span className={styles.mobileIndicatorCount}>
                  {activeSectionMeta.current}/{activeSectionMeta.total}
                </span>
              </div>
              <div className={styles.mobileIndicatorTrack}>
                <div
                  className={styles.mobileIndicatorFill}
                  style={{ width: `${activeSectionMeta.progressPercent}%` }}
                />
              </div>
            </div>
          </section>

          <div id="overview" className={styles.anchorSection}>
            <OverviewCards
              totalLicenses={totals.licenses}
              totalDevices={totals.devices}
              recentLogs={totals.logs}
              adminLogs={totals.adminLogs}
            />
          </div>

          <div id="trends" className={styles.anchorSection}>
            <TrendWidgets licenses={filteredData.licenses} logs={filteredData.logs} />
          </div>

          <div id="licenses" className={styles.anchorSection}>
            <LicensesTable
              licenses={filteredData.licenses}
              onLicenseDeleted={handleLicenseDeleted}
              onLicenseUpdated={handleLicenseUpdated}
              pushToast={pushToast}
            />
          </div>

          <div id="devices" className={styles.anchorSection}>
            <DevicesTable
              devices={filteredData.devices}
              onDeviceReset={handleDeviceReset}
              pushToast={pushToast}
            />
          </div>

          <div id="auth-logs" className={styles.anchorSection}>
            <AuthLogsTable logs={filteredData.logs} />
          </div>

          <div id="admin-logs" className={styles.anchorSection}>
            <AdminAuditLogsTable logs={filteredData.adminAuditLogs} />
          </div>
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
