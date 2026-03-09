'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { LicenseRow } from './types';

type Props = {
  licenses: LicenseRow[];
  showSensitive: boolean;
  onLicenseDeleted: (licenseId: string) => void;
  onLicenseUpdated: (license: LicenseRow) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

const PAGE_SIZE = 8;

export default function LicensesTable({
  licenses,
  showSensitive,
  onLicenseDeleted,
  onLicenseUpdated,
  pushToast,
}: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');

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

  async function updateLicense(licenseId: string, payload: { licenseKey?: string; status?: 'active' | 'inactive' }) {
    setBusyId(licenseId);

    try {
      const response = await fetch('/api/admin/update-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseId, ...payload }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to update license', 'error');
        return;
      }

      onLicenseUpdated(data.license);
      pushToast('License updated');
    } catch {
      pushToast('Network error while updating license', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function deleteLicense(licenseId: string) {
    if (!confirm('Delete this license key?')) {
      return;
    }

    setBusyId(licenseId);
    try {
      const response = await fetch('/api/admin/delete-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseId }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to delete license', 'error');
        return;
      }

      onLicenseDeleted(licenseId);
      pushToast('License deleted');
    } catch {
      pushToast('Network error while deleting license', 'error');
    } finally {
      setBusyId('');
    }
  }

  function editKey(license: LicenseRow) {
    const nextKey = prompt('Enter new license key', license.license_key);
    if (!nextKey || nextKey.trim() === '' || nextKey.trim() === license.license_key) {
      return;
    }

    void updateLicense(license.id, { licenseKey: nextKey.trim() });
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
              <th>Actions</th>
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
                <td>
                  <div className={styles.actionGroup}>
                    <button
                      className={styles.btnGhost}
                      onClick={() => editKey(license)}
                      disabled={busyId === license.id}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.btnGhost}
                      onClick={() =>
                        updateLicense(license.id, {
                          status: license.status === 'active' ? 'inactive' : 'active',
                        })
                      }
                      disabled={busyId === license.id}
                    >
                      {license.status === 'active' ? 'Ban' : 'Activate'}
                    </button>
                    <button
                      className={styles.btnDanger}
                      onClick={() => deleteLicense(license.id)}
                      disabled={busyId === license.id}
                    >
                      Delete
                    </button>
                  </div>
                </td>
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
            <div className={styles.actionGroup}>
              <button
                className={styles.btnGhost}
                onClick={() => editKey(license)}
                disabled={busyId === license.id}
              >
                Edit
              </button>
              <button
                className={styles.btnGhost}
                onClick={() =>
                  updateLicense(license.id, {
                    status: license.status === 'active' ? 'inactive' : 'active',
                  })
                }
                disabled={busyId === license.id}
              >
                {license.status === 'active' ? 'Ban' : 'Activate'}
              </button>
              <button
                className={styles.btnDanger}
                onClick={() => deleteLicense(license.id)}
                disabled={busyId === license.id}
              >
                Delete
              </button>
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
