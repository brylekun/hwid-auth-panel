'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { AuthLogRow } from './types';

type Props = {
  logs: AuthLogRow[];
  showSensitive: boolean;
};

const PAGE_SIZE = 10;

export default function AuthLogsTable({ logs, showSensitive }: Props) {
  const [query, setQuery] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resultClass(result: string) {
    return `${styles.badge} ${result === 'approved' ? styles.active : styles.inactive}`;
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Recent Auth Logs</h2>
        <span className={styles.metaPill}>{filtered.length} items</span>
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
              <th>License Key</th>
              <th>HWID Hash</th>
              <th>Result</th>
              <th>Reason</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((log) => (
              <tr key={log.id}>
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
    </section>
  );
}
