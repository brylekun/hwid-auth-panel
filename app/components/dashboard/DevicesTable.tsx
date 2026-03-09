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
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
      {filtered.length === 0 ? <p className={styles.empty}>No devices found.</p> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>HWID Hash</th>
              <th>Device Name</th>
              <th>Status</th>
              <th>First Seen</th>
              <th>Last Seen</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((device) => (
              <tr key={device.id}>
                <td>{maskValue(device.hwid_hash, showSensitive, 6)}</td>
                <td>{device.device_name || 'Unknown'}</td>
                <td><span className={badgeClass(device.status)}>{device.status || 'inactive'}</span></td>
                <td>{formatDateTime(device.first_seen_at)}</td>
                <td>{formatDateTime(device.last_seen_at)}</td>
                <td>
                  <ResetDeviceButton
                    deviceId={device.id}
                    onReset={onDeviceReset}
                    pushToast={pushToast}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.mobileList}>
        {paged.map((device) => (
          <article key={device.id} className={styles.mobileCard}>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>HWID</span>
              <span>{maskValue(device.hwid_hash, showSensitive, 6)}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Device</span>
              <span>{device.device_name || 'Unknown'}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Status</span>
              <span className={badgeClass(device.status)}>{device.status || 'inactive'}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Last Seen</span>
              <span>{formatDateTime(device.last_seen_at)}</span>
            </div>
            <ResetDeviceButton deviceId={device.id} onReset={onDeviceReset} pushToast={pushToast} />
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
    </section>
  );
}
