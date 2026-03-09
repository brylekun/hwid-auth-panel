'use client';

import { useMemo, useState } from 'react';
import { formatDateTime, getLicenseExpiryInfo, maskValue, normalize } from './format';
import styles from './dashboard.module.css';
import type { DeviceRow, LicenseRow } from './types';

type Props = {
  licenses: LicenseRow[];
  devices: DeviceRow[];
  onLicenseDeleted: (licenseId: string) => void;
  onLicenseUpdated: (license: LicenseRow) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

const PAGE_SIZE = 8;

function isExpired(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  const expiryMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryMs)) {
    return false;
  }

  return expiryMs <= Date.now();
}

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoFromLocalDateTimeInput(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export default function LicensesTable({
  licenses,
  devices,
  onLicenseDeleted,
  onLicenseUpdated,
  pushToast,
}: Props) {
  const [sortBy, setSortBy] = useState<'license_key' | 'status' | 'max_devices' | 'expires_at' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSensitive, setShowSensitive] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [actionType, setActionType] = useState<'edit' | 'status' | 'delete' | null>(null);
  const [selected, setSelected] = useState<LicenseRow | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<LicenseRow | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftExpiresAt, setDraftExpiresAt] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query);
    return licenses.filter((license) => {
      const derivedStatus = isExpired(license.expires_at)
        ? 'expired'
        : license.status === 'active'
          ? 'active'
          : 'inactive';
      const statusMatch =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? derivedStatus === 'active'
            : derivedStatus === 'inactive' || derivedStatus === 'expired';
      if (!statusMatch) {
        return false;
      }

      if (!q) {
        return true;
      }

      return normalize(license.license_key).includes(q);
    });
  }, [licenses, query, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let left = '';
      let right = '';

      if (sortBy === 'max_devices') {
        return sortDir === 'asc'
          ? a.max_devices - b.max_devices
          : b.max_devices - a.max_devices;
      }

      if (sortBy === 'expires_at') {
        left = a.expires_at || '';
        right = b.expires_at || '';
      } else if (sortBy === 'created_at') {
        left = a.created_at || '';
        right = b.created_at || '';
      } else if (sortBy === 'status') {
        left = a.status || '';
        right = b.status || '';
      } else {
        left = a.license_key || '';
        right = b.license_key || '';
      }

      return sortDir === 'asc'
        ? left.localeCompare(right)
        : right.localeCompare(left);
    });
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const devicesByLicenseId = useMemo(() => {
    const map = new Map<string, DeviceRow[]>();
    for (const device of devices) {
      if (!device.license_id) {
        continue;
      }
      const list = map.get(device.license_id) || [];
      list.push(device);
      map.set(device.license_id, list);
    }
    return map;
  }, [devices]);

  function badgeClass(status: string) {
    if (status === 'expired') {
      return `${styles.badge} ${styles.statusExpired}`;
    }

    return `${styles.badge} ${status === 'active' ? styles.active : styles.inactive}`;
  }

  function getDisplayStatus(license: LicenseRow) {
    if (isExpired(license.expires_at)) {
      return 'expired';
    }

    return license.status === 'active' ? 'active' : 'inactive';
  }

  async function updateLicense(
    licenseId: string,
    payload: { licenseKey?: string; status?: 'active' | 'inactive'; expiresAt?: string | null }
  ) {
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

  async function copyLicenseKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast('License key copied');
    } catch {
      pushToast('Failed to copy license key', 'error');
    }
  }

  function getExpiryBadgeClass(state: 'active' | 'expired' | 'never' | 'invalid') {
    if (state === 'active') {
      return `${styles.badge} ${styles.expiryActive}`;
    }

    if (state === 'expired') {
      return `${styles.badge} ${styles.expiryExpired}`;
    }

    return `${styles.badge} ${styles.expiryNeutral}`;
  }

  function getUsedBy(licenseId: string) {
    const linked = devicesByLicenseId.get(licenseId) || [];
    if (linked.length === 0) {
      return 'No device';
    }

    const sortedDevices = [...linked].sort((a, b) =>
      String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || ''))
    );
    const primary = sortedDevices[0];
    const primaryLabel = primary.device_name?.trim() || maskValue(primary.hwid_hash, false, 6);

    if (sortedDevices.length === 1) {
      return primaryLabel;
    }

    return `${primaryLabel} (+${sortedDevices.length - 1} more)`;
  }

  function openAction(type: 'edit' | 'status' | 'delete', license: LicenseRow) {
    setActionType(type);
    setSelected(license);
    setDraftKey(license.license_key);
    setDraftExpiresAt(
      license.expires_at ? toLocalDateTimeInputValue(new Date(license.expires_at)) : ''
    );
  }

  function closeAction() {
    if (busyId) {
      return;
    }

    setActionType(null);
    setSelected(null);
    setDraftKey('');
    setDraftExpiresAt('');
  }

  function extendExpiryBy(durationMs: number) {
    if (!selected) {
      return;
    }

    const nowMs = Date.now();
    const currentExpiryMs = selected.expires_at
      ? new Date(selected.expires_at).getTime()
      : Number.NaN;
    const baseMs = Number.isNaN(currentExpiryMs)
      ? nowMs
      : Math.max(currentExpiryMs, nowMs);
    setDraftExpiresAt(toLocalDateTimeInputValue(new Date(baseMs + durationMs)));
  }

  async function confirmAction() {
    if (!selected || !actionType) {
      return;
    }

    if (actionType === 'edit') {
      const next = draftKey.trim();
      if (!next) {
        pushToast('License key cannot be empty', 'error');
        return;
      }

      const payload = {} as { licenseKey?: string; expiresAt?: string | null };

      if (next !== selected.license_key) {
        payload.licenseKey = next;
      }

      const originalExpiryMs = selected.expires_at
        ? new Date(selected.expires_at).getTime()
        : Number.NaN;
      const nextExpiryMs = draftExpiresAt ? new Date(draftExpiresAt).getTime() : Number.NaN;
      const expiryChanged =
        (selected.expires_at == null && draftExpiresAt !== '') ||
        (selected.expires_at != null && draftExpiresAt === '') ||
        (selected.expires_at != null &&
          draftExpiresAt !== '' &&
          !Number.isNaN(originalExpiryMs) &&
          !Number.isNaN(nextExpiryMs) &&
          Math.abs(originalExpiryMs - nextExpiryMs) >= 60 * 1000);

      if (expiryChanged) {
        if (!draftExpiresAt) {
          payload.expiresAt = null;
        } else {
          const isoValue = toIsoFromLocalDateTimeInput(draftExpiresAt);
          if (!isoValue) {
            pushToast('Invalid expiration date', 'error');
            return;
          }
          payload.expiresAt = isoValue;
        }
      }

      if (!payload.licenseKey && payload.expiresAt === undefined) {
        pushToast('No changes to save', 'error');
        return;
      }

      await updateLicense(selected.id, payload);
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
      <div className={styles.licenseToolsRow}>
        <select
          value={sortBy}
          onChange={(event) =>
            setSortBy(
              event.target.value as 'license_key' | 'status' | 'max_devices' | 'expires_at' | 'created_at'
            )
          }
          className={styles.select}
        >
          <option value="created_at">Sort: Created</option>
          <option value="license_key">Sort: Key</option>
          <option value="status">Sort: Status</option>
          <option value="max_devices">Sort: Max Devices</option>
          <option value="expires_at">Sort: Expires</option>
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
      {filtered.length === 0 ? <p className={styles.empty}>No licenses found.</p> : null}
      <div className={styles.licenseCards}>
        {paged.map((license) => (
          <article
            key={license.id}
            className={styles.licenseCard}
            onClick={() => setSelectedDetails(license)}
          >
            <div className={styles.licenseCardHead}>
              <span className={styles.badgeClassless}>License</span>
              <span className={badgeClass(getDisplayStatus(license))}>{getDisplayStatus(license)}</span>
            </div>
            <div className={styles.licenseCardKey}>
              <span className={styles.keyCell}>
                <span>{maskValue(license.license_key, showSensitive)}</span>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={(event) => {
                    event.stopPropagation();
                    void copyLicenseKey(license.license_key);
                  }}
                  title="Copy license key"
                  aria-label="Copy license key"
                >
                  Copy
                </button>
              </span>
            </div>
            <div className={styles.licenseFacts}>
              <div className={styles.licenseFact}>
                <span className={styles.mobileLabel}>Created:</span>
                <span className={styles.licenseFactValue}>{formatDateTime(license.created_at)}</span>
              </div>
              <div className={styles.licenseFact}>
                <span className={styles.mobileLabel}>Used by:</span>
                <span className={styles.licenseFactValue}>{getUsedBy(license.id)}</span>
              </div>
            </div>
            <div className={styles.licenseCardMeta}>
              <div className={styles.licenseCardMetaItem}>
                <p className={styles.mobileLabel}>Expiry</p>
                <div className={styles.expiryStack}>
                  {(() => {
                    const expiry = getLicenseExpiryInfo(license.expires_at);
                    return (
                      <>
                        <span className={getExpiryBadgeClass(expiry.state)}>
                          {expiry.state === 'active'
                            ? 'Active'
                            : expiry.state === 'expired'
                              ? 'Expired'
                              : 'Never'}
                        </span>
                        <span className={styles.expiryHint}>{expiry.label}</span>
                        {expiry.state !== 'never' ? (
                          <span className={styles.expiryDate}>{expiry.dateLabel}</span>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className={styles.actionGroup} onClick={(event) => event.stopPropagation()}>
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
          <div
            className={`${styles.modalCard} ${actionType === 'edit' ? styles.modalCardEdit : ''}`}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>
              {actionType === 'edit' ? 'Edit License Key' : actionType === 'status'
                ? selected.status === 'active' ? 'Ban License' : 'Activate License'
                : 'Delete License'}
            </h3>
            {actionType === 'edit' ? (
              <div className={styles.modalBody}>
                <p className={styles.modalText}>Update key and expiry duration for this license.</p>
                <input
                  className={styles.input}
                  value={draftKey}
                  onChange={(event) => setDraftKey(event.target.value)}
                  autoFocus
                />
                <div className={styles.modalSection}>
                  <p className={styles.modalText}>Current expiry</p>
                  {(() => {
                    const expiry = getLicenseExpiryInfo(selected.expires_at);
                    return (
                      <div className={styles.expiryStack}>
                        <span className={getExpiryBadgeClass(expiry.state)}>
                          {expiry.state === 'active'
                            ? 'Active'
                            : expiry.state === 'expired'
                              ? 'Expired'
                              : 'Never'}
                        </span>
                        <span className={styles.expiryHint}>{expiry.label}</span>
                        {expiry.state !== 'never' ? (
                          <span className={styles.expiryDate}>{expiry.dateLabel}</span>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
                <div className={styles.modalSection}>
                  <p className={styles.modalText}>Extend duration</p>
                  <div className={styles.modalQuickActions}>
                    <button type="button" className={styles.btnMini} onClick={() => extendExpiryBy(60 * 60 * 1000)}>
                      +1h
                    </button>
                    <button type="button" className={styles.btnMini} onClick={() => extendExpiryBy(24 * 60 * 60 * 1000)}>
                      +24h
                    </button>
                    <button type="button" className={styles.btnMini} onClick={() => extendExpiryBy(7 * 24 * 60 * 60 * 1000)}>
                      +7d
                    </button>
                    <button type="button" className={styles.btnMini} onClick={() => extendExpiryBy(30 * 24 * 60 * 60 * 1000)}>
                      +30d
                    </button>
                    <button type="button" className={styles.btnMini} onClick={() => setDraftExpiresAt('')}>
                      Never
                    </button>
                  </div>
                </div>
                <div className={styles.modalSection}>
                  <p className={styles.modalText}>Set exact expiration</p>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={draftExpiresAt}
                    onChange={(event) => setDraftExpiresAt(event.target.value)}
                  />
                </div>
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
      {selectedDetails ? (
        <>
          <div className={styles.drawerOverlay} onClick={() => setSelectedDetails(null)} />
          <aside className={styles.drawerPanel}>
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitle}>License Details</h3>
              <button className={styles.btnGhost} onClick={() => setSelectedDetails(null)}>Close</button>
            </div>
            <div className={styles.drawerGrid}>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>License Key</p><p className={styles.drawerValue}>{selectedDetails.license_key}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Status</p><p className={styles.drawerValue}>{getDisplayStatus(selectedDetails)}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Used by</p><p className={styles.drawerValue}>{getUsedBy(selectedDetails.id)}</p></div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Expiry</p>
                {(() => {
                  const expiry = getLicenseExpiryInfo(selectedDetails.expires_at);
                  return (
                    <div className={styles.expiryStack}>
                      <span className={getExpiryBadgeClass(expiry.state)}>
                        {expiry.state === 'active'
                          ? 'Active'
                          : expiry.state === 'expired'
                            ? 'Expired'
                            : 'Never'}
                      </span>
                      <span className={styles.expiryHint}>{expiry.label}</span>
                      {expiry.state !== 'never' ? (
                        <span className={styles.expiryDate}>{expiry.dateLabel}</span>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>Created At</p><p className={styles.drawerValue}>{formatDateTime(selectedDetails.created_at)}</p></div>
              <div className={styles.drawerItem}><p className={styles.drawerLabel}>ID</p><p className={styles.drawerValue}>{selectedDetails.id}</p></div>
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
