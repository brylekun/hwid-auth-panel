'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { LicenseRow } from './types';

type Props = {
  licenses: LicenseRow[];
  showSensitive: boolean;
};

const PAGE_SIZE = 8;

export default function LicensesTable({ licenses, showSensitive }: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return licenses.filter((license) => {
      const statusMatch = statusFilter === 'all' || license.status === statusFilter;
      if (!statusMatch) {
        return false;
      }

      if (!q) {
        return true;
      }

      return normalize(license.license_key).includes(q);
    });
  }, [licenses, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function badgeClass(status: string) {
    return `${styles.badge} ${status === 'active' ? styles.active : styles.inactive}`;
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Licenses</h2>
        <span className={styles.metaPill}>{filtered.length} items</span>
      </div>
      <div className={styles.controlRow}>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search by license key"
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
      {filtered.length === 0 ? <p className={styles.empty}>No licenses found.</p> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>License Key</th>
              <th>Status</th>
              <th>Max Devices</th>
              <th>Expires At</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((license) => (
              <tr key={license.id}>
                <td>{maskValue(license.license_key, showSensitive)}</td>
                <td><span className={badgeClass(license.status)}>{license.status}</span></td>
                <td>{license.max_devices}</td>
                <td>{formatDateTime(license.expires_at)}</td>
                <td>{formatDateTime(license.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.mobileList}>
        {paged.map((license) => (
          <article key={license.id} className={styles.mobileCard}>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>License</span>
              <span>{maskValue(license.license_key, showSensitive)}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Status</span>
              <span className={badgeClass(license.status)}>{license.status}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Max Devices</span>
              <span>{license.max_devices}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Expires</span>
              <span>{formatDateTime(license.expires_at)}</span>
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
