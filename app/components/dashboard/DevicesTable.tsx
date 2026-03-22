'use client';

import { useMemo, useState } from 'react';
import { Cpu, Eye, EyeOff, MoreHorizontal, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import ResetDeviceButton from '../ResetDeviceButton';
import { formatDateTime, normalize } from './format';
import styles from './dashboard.module.css';
import type { DeviceRow, LicenseRow } from './types';

type Props = {
  devices: DeviceRow[];
  allDevices?: DeviceRow[];
  licenses: LicenseRow[];
  onDeviceReset: (payload: { deviceId: string; hwidHash?: string }) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

const PAGE_SIZE = 8;

export default function DevicesTable({
  devices,
  allDevices,
  licenses,
  onDeviceReset,
  pushToast,
}: Props) {
  const [sortBy, setSortBy] = useState<'hwid_hash' | 'device_name' | 'status' | 'first_seen_at' | 'last_seen_at'>('last_seen_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedDetails, setSelectedDetails] = useState<DeviceRow | null>(null);
  const historySourceDevices = allDevices || devices;

  const uniqueDevices = useMemo(() => {
    const byHwid = new Map<string, DeviceRow>();

    function parseMs(value: string) {
      const ms = new Date(value).getTime();
      return Number.isNaN(ms) ? null : ms;
    }

    function pickEarlier(left: string, right: string) {
      const leftMs = parseMs(left);
      const rightMs = parseMs(right);
      if (leftMs !== null && rightMs !== null) {
        return leftMs <= rightMs ? left : right;
      }
      if (leftMs !== null) return left;
      if (rightMs !== null) return right;
      return left <= right ? left : right;
    }

    function pickLater(left: string, right: string) {
      const leftMs = parseMs(left);
      const rightMs = parseMs(right);
      if (leftMs !== null && rightMs !== null) {
        return leftMs >= rightMs ? left : right;
      }
      if (leftMs !== null) return left;
      if (rightMs !== null) return right;
      return left >= right ? left : right;
    }

    for (const device of devices) {
      const key = normalize(device.hwid_hash || '');
      if (!key) {
        continue;
      }

      const existing = byHwid.get(key);
      if (!existing) {
        byHwid.set(key, device);
        continue;
      }

      const mergedLastSeen = pickLater(existing.last_seen_at, device.last_seen_at);
      const mergedFirstSeen = pickEarlier(existing.first_seen_at, device.first_seen_at);

      const representative =
        mergedLastSeen === device.last_seen_at ? device : existing;

      const mergedStatus =
        existing.status === 'active' || device.status === 'active'
          ? 'active'
          : existing.status || device.status || 'inactive';

      byHwid.set(key, {
        ...representative,
        first_seen_at: mergedFirstSeen,
        last_seen_at: mergedLastSeen,
        status: mergedStatus,
        device_name: representative.device_name || existing.device_name || device.device_name || null,
      });
    }

    return Array.from(byHwid.values());
  }, [devices]);

  const filtered = useMemo(() => {
    const q = normalize(query);

    return uniqueDevices.filter((device) => {
      const statusMatch = statusFilter === 'all' || (device.status || '').toLowerCase() === statusFilter;
      if (!statusMatch) return false;

      if (!q) return true;

      return normalize(device.hwid_hash).includes(q) || normalize(device.device_name || '').includes(q);
    });
  }, [uniqueDevices, query, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const left = String(a[sortBy] || '');
      const right = String(b[sortBy] || '');
      return sortDir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
    });
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const licenseKeyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const license of licenses) {
      map.set(license.id, license.license_key);
    }
    return map;
  }, [licenses]);

  const keysByHwid = useMemo(() => {
    const map = new Map<string, Array<{ key: string; lastSeenAt: string }>>();

    for (const device of historySourceDevices) {
      const hwid = normalize(device.hwid_hash || '');
      if (!hwid || !device.license_id) {
        continue;
      }

      const keyValue = licenseKeyById.get(device.license_id) || `License ID: ${device.license_id}`;
      const list = map.get(hwid) || [];
      const existingIndex = list.findIndex((item) => item.key === keyValue);

      if (existingIndex === -1) {
        list.push({
          key: keyValue,
          lastSeenAt: device.last_seen_at,
        });
      } else {
        const existingTime = new Date(list[existingIndex].lastSeenAt).getTime();
        const currentTime = new Date(device.last_seen_at).getTime();
        if (!Number.isNaN(currentTime) && (Number.isNaN(existingTime) || currentTime > existingTime)) {
          list[existingIndex] = {
            key: keyValue,
            lastSeenAt: device.last_seen_at,
          };
        }
      }

      map.set(hwid, list);
    }

    const normalized = new Map<string, string[]>();
    for (const [hwid, list] of map) {
      const sortedList = [...list].sort(
        (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
      );
      normalized.set(hwid, sortedList.map((item) => item.key));
    }

    return normalized;
  }, [historySourceDevices, licenseKeyById]);

  function badgeClass(status: string | null) {
    return `${styles.badge} ${status === 'active' ? styles.active : styles.inactive}`;
  }

  function formatDeviceHwid(value: string, reveal: boolean) {
    if (reveal) return value;
    if (!value) return 'N/A';
    if (value.length <= 14) return `******${value.slice(-6)}`;
    return `${value.slice(0, 4)}...${value.slice(-6)}`;
  }

  function compactDate(value: string) {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.panelEyebrow}>Hardware bindings</p>
          <h2 className={styles.sectionTitle}>Devices</h2>
        </div>

        <div className={styles.sectionTools}>
          <span className={styles.metaPill}>{filtered.length} items</span>
          <button
            className={styles.eyeBtn}
            onClick={() => setShowSensitive((prev) => !prev)}
            title={showSensitive ? 'Hide sensitive data' : 'Show sensitive data'}
            aria-label={showSensitive ? 'Hide sensitive data' : 'Show sensitive data'}
            type="button"
          >
            {showSensitive ? <EyeOff size={16} className={styles.eyeIcon} /> : <Eye size={16} className={styles.eyeIcon} />}
          </button>
        </div>
      </div>

      <div className={styles.controlRow}>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search HWID or device name"
          className={styles.input}
        />

        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className={styles.select}
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className={styles.licenseToolsRow}>
        <select
          value={sortBy}
          onChange={(event) =>
            setSortBy(
              event.target.value as 'hwid_hash' | 'device_name' | 'status' | 'first_seen_at' | 'last_seen_at'
            )
          }
          className={styles.select}
        >
          <option value="last_seen_at">Sort: Last Seen</option>
          <option value="first_seen_at">Sort: First Seen</option>
          <option value="device_name">Sort: Device Name</option>
          <option value="hwid_hash">Sort: HWID</option>
          <option value="status">Sort: Status</option>
        </select>

        <select
          value={sortDir}
          onChange={(event) => setSortDir(event.target.value as 'asc' | 'desc')}
          className={styles.select}
        >
          <option value="desc">Direction: Desc</option>
          <option value="asc">Direction: Asc</option>
        </select>
      </div>

      {filtered.length === 0 ? <p className={styles.empty}>No devices found.</p> : null}

      <div className={styles.licenseCards}>
        {paged.map((device) => (
          <article
            key={device.id}
            className={styles.licenseCard}
            onClick={() => setSelectedDetails(device)}
          >
            <div className={styles.licenseCardHead}>
              <div className={styles.licenseCardHeadLeft}>
                <span className={styles.badgeClassless}>Device</span>
                <span className={badgeClass(device.status)}>{device.status || 'inactive'}</span>
              </div>

              <button
                type="button"
                className={styles.licenseIconBtn}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedDetails(device);
                }}
                aria-label="Open device details"
                title="Open device details"
              >
                <MoreHorizontal size={16} strokeWidth={2} />
              </button>
            </div>

            <div className={styles.licenseCardKey}>
              <div className={styles.licenseKeyRow}>
                <span className={styles.licenseKeyIcon}>
                  <Cpu size={16} strokeWidth={2} />
                </span>

                <span className={styles.hashValue}>
                  {formatDeviceHwid(device.hwid_hash, showSensitive)}
                </span>
              </div>
            </div>

            <div className={styles.licenseStatsGrid}>
              <div className={styles.licenseStatBox}>
                <span className={styles.licenseStatIcon}>
                  <MonitorSmartphone size={16} strokeWidth={2} />
                </span>
                <div>
                  <p className={styles.licenseStatLabel}>Device Name</p>
                  <p className={styles.licenseStatValue}>{device.device_name || 'Unknown'}</p>
                </div>
              </div>

              <div className={styles.licenseStatBox}>
                <span className={styles.licenseStatIcon}>
                  <ShieldCheck size={16} strokeWidth={2} />
                </span>
                <div>
                  <p className={styles.licenseStatLabel}>First Seen</p>
                  <p className={styles.licenseStatValue}>{compactDate(device.first_seen_at)}</p>
                </div>
              </div>
            </div>

            <div className={styles.licenseFacts}>
              <div className={styles.licenseFact}>
                <span className={styles.mobileLabel}>Last Seen:</span>
                <span className={styles.licenseFactValue}>
                  {formatDateTime(device.last_seen_at)}
                </span>
              </div>
            </div>

            <div
              className={`${styles.actionGroup} ${styles.deviceAction}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.deviceActionSingle}>
                <ResetDeviceButton
                  deviceId={device.id}
                  hwidHash={device.hwid_hash}
                  onReset={onDeviceReset}
                  pushToast={pushToast}
                />
              </div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className={styles.pagination}>
          <button className={styles.btnGhost} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} type="button">
            Prev
          </button>
          <span>{safePage} / {totalPages}</span>
          <button className={styles.btnGhost} disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} type="button">
            Next
          </button>
        </div>
      ) : null}

      {selectedDetails ? (
        <>
          <div className={styles.drawerOverlay} onClick={() => setSelectedDetails(null)} />
          <aside className={styles.drawerPanel}>
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitle}>Device Details</h3>
              <button className={styles.btnGhost} onClick={() => setSelectedDetails(null)} type="button">
                Close
              </button>
            </div>

            <div className={styles.drawerGrid}>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>HWID Hash</p>
                <p className={styles.drawerValue}>{selectedDetails.hwid_hash}</p>
              </div>

              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Device Name</p>
                <p className={styles.drawerValue}>{selectedDetails.device_name || 'Unknown'}</p>
              </div>

              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Status</p>
                <p className={styles.drawerValue}>{selectedDetails.status || 'inactive'}</p>
              </div>

              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>License Keys Used</p>
                <p className={styles.drawerValue}>
                  {(() => {
                    const keys = keysByHwid.get(normalize(selectedDetails.hwid_hash || '')) || [];
                    return keys.length > 0 ? keys.join(' | ') : 'No key history';
                  })()}
                </p>
              </div>

              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>First Seen</p>
                <p className={styles.drawerValue}>{formatDateTime(selectedDetails.first_seen_at)}</p>
              </div>

              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Last Seen</p>
                <p className={styles.drawerValue}>{formatDateTime(selectedDetails.last_seen_at)}</p>
              </div>

              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>ID</p>
                <p className={styles.drawerValue}>{selectedDetails.id}</p>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
