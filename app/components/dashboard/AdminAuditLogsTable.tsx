'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { AdminAuditLogRow } from './types';

type Props = {
  logs: AdminAuditLogRow[];
};

const PAGE_SIZE = 10;

export default function AdminAuditLogsTable({ logs }: Props) {
  const [sortBy, setSortBy] = useState<'admin_username' | 'action_type' | 'target_type' | 'target_value' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedDetails, setSelectedDetails] = useState<AdminAuditLogRow | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return logs.filter((log) => {
      const actionMatch = actionFilter === 'all' || log.action_type === actionFilter;
      if (!actionMatch) {
        return false;
      }

      if (!q) {
        return true;
      }

      return (
        normalize(log.admin_username).includes(q) ||
        normalize(log.action_type).includes(q) ||
        normalize(log.target_type || '').includes(q) ||
        normalize(log.target_value || '').includes(q)
      );
    });
  }, [logs, query, actionFilter]);

  const uniqueActions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action_type))).sort();
  }, [logs]);

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

  function toggleSort(column: 'admin_username' | 'action_type' | 'target_type' | 'target_value' | 'created_at') {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDir('asc');
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Admin Audit Logs</h2>
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
          placeholder="Search admin, action, or target"
          className={styles.input}
        />
        <select
          value={actionFilter}
          onChange={(event) => {
            setActionFilter(event.target.value);
            setPage(1);
          }}
          className={styles.select}
        >
          <option value="all">All actions</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? <p className={styles.empty}>No admin audit logs found.</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('admin_username')}>Admin<span className={styles.sortIndicator}>{sortBy === 'admin_username' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('action_type')}>Action<span className={styles.sortIndicator}>{sortBy === 'action_type' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('target_type')}>Target Type<span className={styles.sortIndicator}>{sortBy === 'target_type' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('target_value')}>Target Value<span className={styles.sortIndicator}>{sortBy === 'target_value' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('created_at')}>Created At<span className={styles.sortIndicator}>{sortBy === 'created_at' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((log) => (
              <tr key={log.id} onClick={() => setSelectedDetails(log)}>
                <td>{log.admin_username}</td>
                <td>{log.action_type}</td>
                <td>{log.target_type}</td>
                <td>{log.target_value ? maskValue(log.target_value, showSensitive, 6) : '-'}</td>
                <td>{formatDateTime(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileList}>
        {paged.map((log) => (
          <article key={log.id} className={styles.mobileCard}>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Admin</span>
              <span>{log.admin_username}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Action</span>
              <span>{log.action_type}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Target</span>
              <span>{log.target_type}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Value</span>
              <span>{log.target_value ? maskValue(log.target_value, showSensitive, 6) : '-'}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>At</span>
              <span>{formatDateTime(log.created_at)}</span>
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
              <h3 className={styles.drawerTitle}>Admin Audit Details</h3>
              <button className={styles.btnGhost} onClick={() => setSelectedDetails(null)}>Close</button>
            </div>
            <div className={styles.drawerGrid}>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Admin</p><p className={styles.drawerValue}>{selectedDetails.admin_username}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Action</p><p className={styles.drawerValue}>{selectedDetails.action_type}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Target Type</p><p className={styles.drawerValue}>{selectedDetails.target_type}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Target Value</p><p className={styles.drawerValue}>{selectedDetails.target_value || '-'}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Created At</p><p className={styles.drawerValue}>{formatDateTime(selectedDetails.created_at)}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Metadata</p><p className={styles.drawerValue}>{JSON.stringify(selectedDetails.metadata || {}, null, 2)}</p></div>
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
