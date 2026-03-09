'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { AdminAuditLogRow } from './types';

type Props = {
  logs: AdminAuditLogRow[];
};

const PAGE_SIZE = 6;

export default function AdminAuditLogsTable({ logs }: Props) {
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedDetails, setSelectedDetails] = useState<AdminAuditLogRow | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query);

    return logs.filter((log) => {
      const actionMatch = actionFilter === 'all' || log.action_type === actionFilter;
      if (!actionMatch) return false;

      if (!q) return true;

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
    return [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.panelEyebrow}>Administrator activity</p>
          <h2 className={styles.sectionTitle}>Admin Audit Logs</h2>
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
          placeholder="Search admin, action, target"
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
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? <p className={styles.empty}>No admin audit logs found.</p> : null}

      <div className={styles.logStream}>
        {paged.map((log) => (
          <button
            key={log.id}
            type="button"
            className={styles.logRow}
            onClick={() => setSelectedDetails(log)}
          >
            <span className={`${styles.logDot} ${styles.logDotPulse} ${styles.logDotNeutral}`} aria-hidden="true" />

            <div className={styles.logMain}>
              <div className={styles.logTop}>
                <div className={styles.logIdentity}>
                  <span className={styles.logAdmin}>{log.admin_username}</span>
                  <span className={styles.logDivider}>•</span>
                  <span className={styles.logAction}>{log.action_type}</span>
                </div>

                <div className={styles.logMetaRight}>
                  <span className={`${styles.badge} ${styles.expiryNeutral}`}>
                    {log.target_type || 'general'}
                  </span>
                  <span className={styles.logTime}>{formatDateTime(log.created_at)}</span>
                </div>
              </div>

              <div className={styles.logBottom}>
                <span className={styles.logReason}>
                  {log.target_value ? maskValue(log.target_value, showSensitive, 6) : 'No target value'}
                </span>
                <span className={styles.logHint}>Click for details</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length > PAGE_SIZE ? (
        <div className={styles.pagination}>
          <button
            className={styles.btnGhost}
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            type="button"
          >
            Prev
          </button>
          <span>{safePage} / {totalPages}</span>
          <button
            className={styles.btnGhost}
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            type="button"
          >
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
              <button className={styles.btnGhost} onClick={() => setSelectedDetails(null)} type="button">
                Close
              </button>
            </div>

            <div className={styles.drawerGrid}>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Admin</p>
                <p className={styles.drawerValue}>{selectedDetails.admin_username}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Action</p>
                <p className={styles.drawerValue}>{selectedDetails.action_type}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Target Type</p>
                <p className={styles.drawerValue}>{selectedDetails.target_type || '-'}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Target Value</p>
                <p className={styles.drawerValue}>{selectedDetails.target_value || '-'}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Created At</p>
                <p className={styles.drawerValue}>{formatDateTime(selectedDetails.created_at)}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Metadata</p>
                <p className={styles.drawerValue}>
                  {JSON.stringify(selectedDetails.metadata || {}, null, 2)}
                </p>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
