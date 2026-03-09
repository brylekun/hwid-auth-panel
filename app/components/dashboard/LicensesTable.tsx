'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { LicenseRow } from './types';

type Props = {
  licenses: LicenseRow[];
  onLicenseDeleted: (licenseId: string) => void;
  onLicenseUpdated: (license: LicenseRow) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

const PAGE_SIZE = 8;

export default function LicensesTable({
  licenses,
  onLicenseDeleted,
  onLicenseUpdated,
  pushToast,
}: Props) {
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [actionType, setActionType] = useState<'edit' | 'status' | 'delete' | null>(null);
  const [selected, setSelected] = useState<LicenseRow | null>(null);
  const [draftKey, setDraftKey] = useState('');

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

  function openAction(type: 'edit' | 'status' | 'delete', license: LicenseRow) {
    setActionType(type);
    setSelected(license);
    setDraftKey(license.license_key);
  }

  function closeAction() {
    if (busyId) {
      return;
    }

    setActionType(null);
    setSelected(null);
    setDraftKey('');
  }

  async function confirmAction() {
    if (!selected || !actionType) {
      return;
    }

    if (actionType === 'edit') {
      const next = draftKey.trim();
      if (!next || next === selected.license_key) {
        pushToast('Enter a different license key', 'error');
        return;
      }

      await updateLicense(selected.id, { licenseKey: next });
      closeAction();
      return;
    }

    if (actionType === 'status') {
      await updateLicense(selected.id, {
        status: selected.status === 'active' ? 'inactive' : 'active',
      });
      closeAction();
      return;
    }

    await deleteLicense(selected.id);
    closeAction();
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Licenses</h2>
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
                      onClick={() => openAction('edit', license)}
                      disabled={busyId === license.id}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.btnGhost}
                      onClick={() => openAction('status', license)}
                      disabled={busyId === license.id}
                    >
                      {license.status === 'active' ? 'Ban' : 'Activate'}
                    </button>
                    <button
                      className={styles.btnDanger}
                      onClick={() => openAction('delete', license)}
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
                onClick={() => openAction('edit', license)}
                disabled={busyId === license.id}
              >
                Edit
              </button>
              <button
                className={styles.btnGhost}
                onClick={() => openAction('status', license)}
                disabled={busyId === license.id}
              >
                {license.status === 'active' ? 'Ban' : 'Activate'}
              </button>
              <button
                className={styles.btnDanger}
                onClick={() => openAction('delete', license)}
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
      {selected && actionType ? (
        <div className={styles.modalOverlay} role="presentation" onClick={closeAction}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {actionType === 'edit' ? 'Edit License Key' : actionType === 'status'
                ? selected.status === 'active' ? 'Ban License' : 'Activate License'
                : 'Delete License'}
            </h3>
            {actionType === 'edit' ? (
              <div className={styles.modalBody}>
                <p className={styles.modalText}>Update the key for this license entry.</p>
                <input
                  className={styles.input}
                  value={draftKey}
                  onChange={(event) => setDraftKey(event.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <p className={styles.modalText}>
                {actionType === 'status'
                  ? `Are you sure you want to ${selected.status === 'active' ? 'ban' : 'activate'} this license?`
                  : 'Are you sure you want to delete this license? This cannot be undone.'}
              </p>
            )}
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={closeAction} disabled={Boolean(busyId)}>
                Cancel
              </button>
              <button
                className={actionType === 'delete' ? styles.btnDanger : styles.btn}
                onClick={() => void confirmAction()}
                disabled={Boolean(busyId)}
              >
                {busyId ? 'Processing...' : actionType === 'edit' ? 'Save' : actionType === 'status'
                  ? selected.status === 'active' ? 'Ban' : 'Activate'
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
