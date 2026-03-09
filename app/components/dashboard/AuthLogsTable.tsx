'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { AuthLogRow } from './types';

type Props = {
  logs: AuthLogRow[];
};

const PAGE_SIZE = 10;

export default function AuthLogsTable({ logs }: Props) {
  const [sortBy, setSortBy] = useState<'license_key' | 'hwid_hash' | 'result' | 'reason' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedDetails, setSelectedDetails] = useState<AuthLogRow | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return logs.filter((log) => {
      const resultMatch = resultFilter === 'all' || log.result === resultFilter;
      if (!resultMatch) {
        return false;
      }

      if (!q) {
        return true;
      }

      return (
        normalize(log.license_key).includes(q) ||
        normalize(log.hwid_hash).includes(q) ||
        normalize(log.reason).includes(q)
      );
    });
  }, [logs, query, resultFilter]);

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

  function toggleSort(column: 'license_key' | 'hwid_hash' | 'result' | 'reason' | 'created_at') {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDir('asc');
  }

  function resultClass(result: string) {
    return `${styles.badge} ${result === 'approved' ? styles.active : styles.inactive}`;
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Recent Auth Logs</h2>
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
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('license_key')}>License Key<span className={styles.sortIndicator}>{sortBy === 'license_key' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('hwid_hash')}>HWID Hash<span className={styles.sortIndicator}>{sortBy === 'hwid_hash' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('result')}>Result<span className={styles.sortIndicator}>{sortBy === 'result' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('reason')}>Reason<span className={styles.sortIndicator}>{sortBy === 'reason' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
              <th><button className={styles.sortBtn} onClick={() => toggleSort('created_at')}>Created At<span className={styles.sortIndicator}>{sortBy === 'created_at' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((log) => (
              <tr key={log.id} onClick={() => setSelectedDetails(log)}>
                <td>{maskValue(log.license_key, showSensitive)}</td>
                <td>{maskValue(log.hwid_hash, showSensitive, 6)}</td>
                <td><span className={resultClass(log.result)}>{log.result}</span></td>
                <td>{log.reason}</td>
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
              <span className={styles.mobileLabel}>License</span>
              <span>{maskValue(log.license_key, showSensitive)}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>HWID</span>
              <span>{maskValue(log.hwid_hash, showSensitive, 6)}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Result</span>
              <span className={resultClass(log.result)}>{log.result}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Reason</span>
              <span>{log.reason}</span>
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
              <h3 className={styles.drawerTitle}>Auth Log Details</h3>
              <button className={styles.btnGhost} onClick={() => setSelectedDetails(null)}>Close</button>
            </div>
            <div className={styles.drawerGrid}>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>License Key</p><p className={styles.drawerValue}>{selectedDetails.license_key}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>HWID Hash</p><p className={styles.drawerValue}>{selectedDetails.hwid_hash}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Result</p><p className={styles.drawerValue}>{selectedDetails.result}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Reason</p><p className={styles.drawerValue}>{selectedDetails.reason}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Created At</p><p className={styles.drawerValue}>{formatDateTime(selectedDetails.created_at)}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>ID</p><p className={styles.drawerValue}>{selectedDetails.id}</p></div>
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
