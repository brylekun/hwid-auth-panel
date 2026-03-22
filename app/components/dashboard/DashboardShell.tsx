'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  KeyRound,
  Cpu,
  PlusCircle,
  ShieldCheck,
  Link2,
} from 'lucide-react';
import AdminLogoutButton from '../AdminLogoutButton';
import AdminAuditLogsTable from './AdminAuditLogsTable';
import AuthLogsTable from './AuthLogsTable';
import CreateLicensePageForm from '@/app/licenses/create/CreateLicensePageForm';
import DevicesTable from './DevicesTable';
import LicensesTable from './LicensesTable';
import OverviewCards from './OverviewCards';
import TrendWidgets from './TrendWidgets';
import WebLoadersTable from './WebLoadersTable';
import styles from './dashboard.module.css';
import { getTodayManilaDayKey, toManilaDayKey } from './format';
import type {
  AdminAuditLogRow,
  AuthLogRow,
  DeviceRow,
  LicenseRow,
  WebLoaderRow,
} from './types';

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
  initialWebLoaders?: WebLoaderRow[];
  view?: 'home' | 'licenses' | 'devices' | 'create-license' | 'web-loaders';
};

const navLinks = [
  { href: '/', label: 'Overview', view: 'home', icon: LayoutDashboard },
  { href: '/licenses', label: 'Licenses', view: 'licenses', icon: KeyRound },
  { href: '/devices', label: 'Devices', view: 'devices', icon: Cpu },
  { href: '/licenses/create', label: 'Create License', view: 'create-license', icon: PlusCircle },
  { href: '/web-loaders', label: 'Web Loaders', view: 'web-loaders', icon: Link2 },
] as const;

const quickFilterOptions: Array<{ value: QuickFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'denied', label: 'Denied' },
  { value: 'rate_limited', label: 'Rate-limited' },
  { value: 'today', label: 'Today' },
  { value: 'last_24h', label: 'Last 24h' },
];

export default function DashboardShell({
  initialLicenses,
  initialDevices,
  initialLogs,
  initialAdminAuditLogs,
  initialWebLoaders = [],
  view = 'home',
}: Props) {
  const [licenses, setLicenses] = useState(initialLicenses);
  const [devices, setDevices] = useState(initialDevices);
  const [logs, setLogs] = useState(initialLogs);
  const [adminAuditLogs, setAdminAuditLogs] = useState(initialAdminAuditLogs);
  const [webLoaders, setWebLoaders] = useState(initialWebLoaders);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [referenceTime] = useState(() => Date.now());
  const [isClearingAuthLogs, setIsClearingAuthLogs] = useState(false);
  const [isClearingAdminAuditLogs, setIsClearingAdminAuditLogs] = useState(false);

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

  function handleDeviceReset({ deviceId, hwidHash }: { deviceId: string; hwidHash?: string }) {
    if (hwidHash) {
      setDevices((prev) => prev.filter((device) => device.hwid_hash !== hwidHash));
      return;
    }

    setDevices((prev) => prev.filter((device) => device.id !== deviceId));
  }

  function handleLicenseDeleted(licenseId: string) {
    setLicenses((prev) => prev.filter((license) => license.id !== licenseId));
  }

  function handleLicenseUpdated(updated: LicenseRow) {
    setLicenses((prev) =>
      prev.map((license) => (license.id === updated.id ? updated : license))
    );
  }

  async function refreshLicenseData() {
    try {
      const response = await fetch('/api/admin/licenses', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to sync licenses from database', 'error');
        return false;
      }

      setLicenses(Array.isArray(data.licenses) ? data.licenses : []);
      setDevices(Array.isArray(data.devices) ? data.devices : []);
      return true;
    } catch {
      pushToast('Network error while syncing licenses', 'error');
      return false;
    }
  }

  async function refreshLogData() {
    try {
      const response = await fetch('/api/admin/logs', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to sync logs from database', 'error');
        return false;
      }

      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setAdminAuditLogs(Array.isArray(data.adminAuditLogs) ? data.adminAuditLogs : []);
      return true;
    } catch {
      pushToast('Network error while syncing logs', 'error');
      return false;
    }
  }

  async function clearAuthLogs() {
    if (isClearingAuthLogs) {
      return;
    }

    setIsClearingAuthLogs(true);
    try {
      const response = await fetch('/api/admin/clear-auth-logs', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to clear auth logs', 'error');
        return;
      }

      await refreshLogData();
      pushToast(data.message || 'Auth logs cleared');
    } catch {
      pushToast('Network error while clearing auth logs', 'error');
    } finally {
      setIsClearingAuthLogs(false);
    }
  }

  async function clearAdminAuditLogs() {
    if (isClearingAdminAuditLogs) {
      return;
    }

    setIsClearingAdminAuditLogs(true);
    try {
      const response = await fetch('/api/admin/clear-admin-audit-logs', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to clear admin audit logs', 'error');
        return;
      }

      await refreshLogData();
      pushToast(data.message || 'Admin audit logs cleared');
    } catch {
      pushToast('Network error while clearing admin audit logs', 'error');
    } finally {
      setIsClearingAdminAuditLogs(false);
    }
  }

  function handleWebLoaderCreated(created: WebLoaderRow) {
    setWebLoaders((prev) => [created, ...prev]);
  }

  function handleWebLoaderUpdated(updated: WebLoaderRow) {
    setWebLoaders((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  function handleWebLoaderDeleted(loaderId: string) {
    setWebLoaders((prev) => prev.filter((item) => item.id !== loaderId));
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

    const inLast24h = (value: string) =>
      new Date(value).getTime() >= referenceTime - 24 * 60 * 60 * 1000;

    const inToday = (value: string) => toManilaDayKey(value) === manilaTodayKey;

    if (quickFilter === 'all') {
      return { licenses, devices, logs, adminAuditLogs, webLoaders };
    }

    if (quickFilter === 'active') {
      return {
        licenses: licenses.filter((item) => item.status === 'active'),
        devices: devices.filter((item) => item.status === 'active'),
        logs,
        adminAuditLogs,
        webLoaders: webLoaders.filter((item) => item.status === 'active'),
      };
    }

    if (quickFilter === 'inactive') {
      return {
        licenses: licenses.filter((item) => item.status !== 'active'),
        devices: devices.filter((item) => item.status !== 'active'),
        logs,
        adminAuditLogs,
        webLoaders: webLoaders.filter((item) => item.status !== 'active'),
      };
    }

    if (quickFilter === 'denied') {
      return {
        licenses,
        devices,
        logs: logs.filter((item) => item.result === 'denied'),
        adminAuditLogs,
        webLoaders,
      };
    }

    if (quickFilter === 'rate_limited') {
      return {
        licenses,
        devices,
        logs: logs.filter((item) => item.reason?.startsWith('rate_limited')),
        adminAuditLogs,
        webLoaders,
      };
    }

    if (quickFilter === 'today') {
      return {
        licenses: licenses.filter((item) => inToday(item.created_at)),
        devices: devices.filter((item) =>
          inToday(item.first_seen_at || item.last_seen_at)
        ),
        logs: logs.filter((item) => inToday(item.created_at)),
        adminAuditLogs: adminAuditLogs.filter((item) =>
          inToday(item.created_at)),
        webLoaders: webLoaders.filter((item) => inToday(item.created_at)),
      };
    }

    return {
      licenses: licenses.filter((item) => inLast24h(item.created_at)),
      devices: devices.filter((item) =>
        inLast24h(item.first_seen_at || item.last_seen_at)
      ),
      logs: logs.filter((item) => inLast24h(item.created_at)),
      adminAuditLogs: adminAuditLogs.filter((item) =>
        inLast24h(item.created_at)
      ),
      webLoaders: webLoaders.filter((item) => inLast24h(item.created_at)),
    };
  }, [quickFilter, licenses, devices, logs, adminAuditLogs, webLoaders, referenceTime]);

  const pageTitle =
    view === 'licenses'
      ? 'Licenses'
      : view === 'devices'
      ? 'Devices'
      : view === 'create-license'
      ? 'Create License'
      : view === 'web-loaders'
      ? 'Web Loaders'
      : 'ThunderTool HWID Panel';

  const pageSubtitle =
    view === 'licenses'
      ? 'Manage keys, status, expiration, and license lifecycle controls.'
      : view === 'devices'
      ? 'Monitor and manage bound devices and their hardware identifiers.'
      : view === 'create-license'
      ? 'Generate and configure new license keys with expiration controls.'
      : view === 'web-loaders'
      ? 'Manage hosted loader links gated by HWID license authorization.'
      : 'Manage licenses, device bindings, and validation activity.';

return (
  <main className={styles.page}>
    <div className="dashboardGlass" />
    <div className={styles.frameGlow} />

      <div className={styles.appShell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarInner}>
            <div className={styles.brandCard}>
              <div className={styles.brandTopline}>
                <span className={styles.brandStatusDot} />
                <span className={styles.brandStatusText}>Secure Session</span>
              </div>

              <div className={styles.sidebarProfile}>
                <div className={styles.sidebarAvatar}>TT</div>
                <div>
                  <p className={styles.sidebarProfileTitle}>
                    ThunderTool Panel
                  </p>
                  <p
                    suppressHydrationWarning
                    className={styles.sidebarProfileMeta}
                  >
                    {generatedAt}
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.sidebarGroup}>
              <p className={styles.sidebarTitle}>Operations</p>

              <div className={styles.navStack}>
              {navLinks.slice(0, 3).map((link) => {
                const Icon = link.icon;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${styles.sideLink} ${link.view === view ? styles.sideLinkActive : ''}`}
                  >
                    <Icon size={16} strokeWidth={2} className={styles.sideLinkIcon} />
                    <span className={styles.sideLinkLabel}>{link.label}</span>
                  </Link>
                );
              })}
              </div>
            </div>

            <div className={styles.sidebarGroup}>
              <p className={styles.sidebarTitle}>Management</p>

              <div className={styles.navStack}>
              {navLinks.slice(3).map((link) => {
                const Icon = link.icon;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${styles.sideLink} ${link.view === view ? styles.sideLinkActive : ''}`}
                  >
                    <Icon size={22} strokeWidth={2} className={styles.sideLinkIcon} />
                    <span className={styles.sideLinkLabel}>{link.label}</span>
                  </Link>
                );
              })}
              </div>
            </div>

            <div className={styles.sidebarSpacer} />

            <div className={styles.sidebarFooter}>
              <div>
                <p className={styles.sidebarFooterTitle}>Admin</p>
                <p className={styles.sidebarFooterMeta}>
                  <ShieldCheck
                    size={14}
                    strokeWidth={2}
                    className={styles.sidebarFooterMetaIcon}
                  />
                  <span>HWID Administrator</span>
                </p>
              </div>

              <AdminLogoutButton className={styles.sidebarLogoutBtn} showIcon />
            </div>
          </div>
        </aside>

        <div className={styles.mainColumn}>
          <header className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Admin Workspace</p>
              <h1 className={styles.heroTitle}>{pageTitle}</h1>
              <p className={styles.heroSubtitle}>{pageSubtitle}</p>

              <div className={styles.heroMeta}>
                <span className={styles.metaPill}>Session Protected</span>
                <span className={styles.metaPill}>HWID Control Center</span>
              </div>
            </div>
          </header>

          {view === 'home' && (
            <section className={styles.quickFilters}>
              {quickFilterOptions.map((option) => (
                <button
                  key={option.value}
                  className={`${styles.filterChip} ${
                    quickFilter === option.value
                      ? styles.filterChipActive
                      : ''
                  }`}
                  onClick={() => setQuickFilter(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </section>
          )}

          <section className={styles.contentStack}>
            {view === 'licenses' && (
              <div className={styles.sectionPanel}>
                <LicensesTable
                  licenses={filteredData.licenses}
                  devices={devices}
                  onLicenseDeleted={handleLicenseDeleted}
                  onLicenseUpdated={handleLicenseUpdated}
                  refreshLicenseData={refreshLicenseData}
                  pushToast={pushToast}
                />
              </div>
            )}

            {view === 'devices' && (
              <div className={styles.sectionPanel}>
                <DevicesTable
                  devices={filteredData.devices}
                  allDevices={devices}
                  licenses={licenses}
                  onDeviceReset={handleDeviceReset}
                  pushToast={pushToast}
                />
              </div>
            )}

            {view === 'create-license' && (
              <div className={styles.sectionPanel}>
                <CreateLicensePageForm embedded />
              </div>
            )}

            {view === 'web-loaders' && (
              <div className={styles.sectionPanel}>
                <WebLoadersTable
                  webLoaders={filteredData.webLoaders}
                  onWebLoaderCreated={handleWebLoaderCreated}
                  onWebLoaderUpdated={handleWebLoaderUpdated}
                  onWebLoaderDeleted={handleWebLoaderDeleted}
                  pushToast={pushToast}
                />
              </div>
            )}

            {view === 'home' && (
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

                <div className={styles.sectionPanel}>
                  <AuthLogsTable
                    logs={filteredData.logs}
                    onClearLogs={clearAuthLogs}
                    isClearingLogs={isClearingAuthLogs}
                    hasAnyLogs={logs.length > 0}
                  />
                </div>

                <div className={styles.sectionPanel}>
                  <AdminAuditLogsTable
                    logs={filteredData.adminAuditLogs}
                    onClearLogs={clearAdminAuditLogs}
                    isClearingLogs={isClearingAdminAuditLogs}
                    hasAnyLogs={adminAuditLogs.length > 0}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <div className={styles.toastWrap}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${
              toast.type === 'error' ? styles.toastError : ''
            }`}
          >
            <span className={styles.toastIndicator} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
