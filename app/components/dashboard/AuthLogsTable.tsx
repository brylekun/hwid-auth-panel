'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { AuthLogRow } from './types';

type Props = {
  logs: AuthLogRow[];
};

const PAGE_SIZE = 6;

export default function AuthLogsTable({ logs }: Props) {
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedDetails, setSelectedDetails] = useState<AuthLogRow | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query);

    return logs.filter((log) => {
      const resultMatch = resultFilter === 'all' || log.result === resultFilter;
      if (!resultMatch) return false;

      if (!q) return true;

      return (
        normalize(log.license_key).includes(q) ||
        normalize(log.hwid_hash).includes(q) ||
        normalize(log.reason).includes(q)
      );
    });
  }, [logs, query, resultFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resultClass(result: string) {
    return `${styles.badge} ${result === 'approved' ? styles.active : styles.inactive}`;
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.panelEyebrow}>Validation activity</p>
          <h2 className={styles.sectionTitle}>Recent Auth Logs</h2>
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
          placeholder="Search license, HWID, reason"
          className={styles.input}
        />
        <select
          value={resultFilter}
          onChange={(event) => {
            setResultFilter(event.target.value);
            setPage(1);
          }}
          className={styles.select}
        >
          <option value="all">All results</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
        </select>
      </div>

      {filtered.length === 0 ? <p className={styles.empty}>No auth logs found.</p> : null}

      <div className={styles.logStream}>
        {paged.map((log) => (
          <button
            key={log.id}
            type="button"
            className={styles.logRow}
            onClick={() => setSelectedDetails(log)}
          >
            <span
              className={`${styles.logDot} ${styles.logDotPulse} ${
                log.result === 'approved' ? styles.logDotSuccess : styles.logDotDanger
              }`}
              aria-hidden="true"
            />

            <div className={styles.logMain}>
              <div className={styles.logTop}>
                <div className={styles.logIdentity}>
                  <span className={styles.logMono}>
                    {maskValue(log.license_key, showSensitive)}
                  </span>
                  <span className={styles.logDivider}>•</span>
                  <span className={styles.logMono}>
                    {maskValue(log.hwid_hash, showSensitive, 6)}
                  </span>
                </div>

                <div className={styles.logMetaRight}>
                  <span className={resultClass(log.result)}>{log.result}</span>
                  <span className={styles.logTime}>{formatDateTime(log.created_at)}</span>
                </div>
              </div>

              <div className={styles.logBottom}>
                <span className={styles.logReason}>{log.reason}</span>
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
              <h3 className={styles.drawerTitle}>Auth Log Details</h3>
              <button className={styles.btnGhost} onClick={() => setSelectedDetails(null)} type="button">
                Close
              </button>
            </div>

            <div className={styles.drawerGrid}>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>License Key</p>
                <p className={styles.drawerValue}>{selectedDetails.license_key}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>HWID Hash</p>
                <p className={styles.drawerValue}>{selectedDetails.hwid_hash}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Result</p>
                <p className={styles.drawerValue}>{selectedDetails.result}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Reason</p>
                <p className={styles.drawerValue}>{selectedDetails.reason}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Created At</p>
                <p className={styles.drawerValue}>{formatDateTime(selectedDetails.created_at)}</p>
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
