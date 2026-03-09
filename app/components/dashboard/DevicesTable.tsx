'use client';

import { useMemo, useState } from 'react';
import ResetDeviceButton from '../ResetDeviceButton';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { DeviceRow } from './types';

type Props = {
  devices: DeviceRow[];
  onDeviceReset: (deviceId: string) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

const PAGE_SIZE = 8;

export default function DevicesTable({ devices, onDeviceReset, pushToast }: Props) {
  const [sortBy, setSortBy] = useState<'hwid_hash' | 'device_name' | 'status' | 'first_seen_at' | 'last_seen_at'>('last_seen_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedDetails, setSelectedDetails] = useState<DeviceRow | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return devices.filter((device) => {
      const statusMatch = statusFilter === 'all' || (device.status || '').toLowerCase() === statusFilter;
      if (!statusMatch) {
        return false;
      }

      if (!q) {
        return true;
      }

      return normalize(device.hwid_hash).includes(q) || normalize(device.device_name || '').includes(q);
    });
  }, [devices, query, statusFilter]);

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

  function badgeClass(status: string | null) {
    return `${styles.badge} ${status === 'active' ? styles.active : styles.inactive}`;
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Devices</h2>
        <div className={styles.sectionTools}>
          <span className={styles.metaPill}>{filtered.length} items</span>
          <button
            className={styles.eyeBtn}
            onClick={() => setShowSensitive((prev) => !prev)}
            title={showSensitive ? 'Hide sensitive data' : 'Show sensitive data'}
            aria-label={showSensitive ? 'Hide sensitive data' : 'Show sensitive data'}
          >
            <svg viewBox="0 0 24 24" className={styles.eyeIcon} aria-hidden="true">
              <path
                d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
              {!showSensitive ? <path d="M4 20L20 4" stroke="currentColor" strokeWidth="1.8" /> : null}
            </svg>
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
              <span className={styles.badgeClassless}>Device</span>
              <span className={badgeClass(device.status)}>{device.status || 'inactive'}</span>
            </div>
            <div className={styles.licenseCardKey}>
              <span className={styles.keyCell}>{maskValue(device.hwid_hash, showSensitive, 6)}</span>
            </div>
            <div className={styles.licenseFacts}>
              <div className={styles.licenseFact}>
                <span className={styles.mobileLabel}>Device Name:</span>
                <span className={styles.licenseFactValue}>{device.device_name || 'Unknown'}</span>
              </div>
              <div className={styles.licenseFact}>
                <span className={styles.mobileLabel}>First Seen:</span>
                <span className={styles.licenseFactValue}>{formatDateTime(device.first_seen_at)}</span>
              </div>
            </div>
            <div className={styles.licenseCardMeta}>
              <div className={styles.licenseCardMetaItem}>
                <p className={styles.mobileLabel}>Last Seen</p>
                <p className={styles.licenseFactValue}>{formatDateTime(device.last_seen_at)}</p>
              </div>
            </div>
            <div className={styles.actionGroup} onClick={(event) => event.stopPropagation()}>
              <ResetDeviceButton deviceId={device.id} onReset={onDeviceReset} pushToast={pushToast} />
            </div>
          </article>
        ))}
      </div>
      {filtered.length > 0 ? (
        <div className={styles.pagination}>
          <button className={styles.btnGhost} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            Prev
          </button>
          <span>{safePage} / {totalPages}</span>
          <button className={styles.btnGhost} disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
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
              <button className={styles.btnGhost} onClick={() => setSelectedDetails(null)}>Close</button>
            </div>
            <div className={styles.drawerGrid}>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>HWID Hash</p><p className={styles.drawerValue}>{selectedDetails.hwid_hash}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Device Name</p><p className={styles.drawerValue}>{selectedDetails.device_name || 'Unknown'}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Status</p><p className={styles.drawerValue}>{selectedDetails.status || 'inactive'}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>First Seen</p><p className={styles.drawerValue}>{formatDateTime(selectedDetails.first_seen_at)}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Last Seen</p><p className={styles.drawerValue}>{formatDateTime(selectedDetails.last_seen_at)}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>ID</p><p className={styles.drawerValue}>{selectedDetails.id}</p></div>
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
