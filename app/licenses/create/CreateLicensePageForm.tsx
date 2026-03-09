'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AdminLogoutButton from '@/app/components/AdminLogoutButton';
import styles from './create-license.module.css';

type ExpiryPreset = '1h' | '24h' | '7d' | '30d' | 'never';

function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () =>
    Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function CreateLicensePageForm() {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState(generateLicenseKey());
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<ExpiryPreset>('never');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  function applyExpiryPreset(preset: ExpiryPreset) {
    setSelectedPreset(preset);
    if (preset === 'never') {
      setExpiresAt('');
      return;
    }

    const now = Date.now();
    const durationMs =
      preset === '1h' ? 60 * 60 * 1000
      : preset === '24h' ? 24 * 60 * 60 * 1000
      : preset === '7d' ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

    setExpiresAt(toLocalDateTimeInputValue(new Date(now + durationMs)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const res = await fetch('/api/admin/create-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          maxDevices,
          expiresAt: expiresAt || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage(data.message || 'Failed to create license');
        setMessageType('error');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setMessage('Network error while creating license');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.showcase}>
          <p className={styles.eyebrow}>Thunder Tool Licensing</p>
          <h1 className={styles.title}>Create New HWID License</h1>
          <p className={styles.subtitle}>
            Generate secure license keys for Thunder Tool with configurable device limits
            and optional expiration settings. Manage HWID authentication and control
            user access to the ImGui menu through a reliable licensing system.
          </p>
          <ul className={styles.tips}>
            <li className={styles.tip}>Generate secure license keys automatically to prevent duplicates and errors.</li>
            <li className={styles.tip}>Configure maximum HWID bindings to prevent account sharing.</li>
            <li className={styles.tip}>Set expiration dates for trials, temporary access, or subscription plans.</li>
          </ul>
        </aside>

        <section className={styles.panel}>
          <div className={styles.topbar}>
            <Link href="/" className={styles.backLink}>Back to Dashboard</Link>
            <AdminLogoutButton />
          </div>
          <h2 className={styles.heading}>Create License</h2>
          <p className={styles.text}>Fill required fields and submit to provision a new license.</p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="licenseKey" className={styles.label}>License Key</label>
              <div className={styles.inline}>
                <input
                  id="licenseKey"
                  className={styles.input}
                  value={licenseKey}
                  onChange={(event) => setLicenseKey(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => setLicenseKey(generateLicenseKey())}
                  disabled={loading}
                >
                  Generate
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="maxDevices" className={styles.label}>Max Devices</label>
              <input
                id="maxDevices"
                type="number"
                min={1}
                max={100}
                className={styles.input}
                value={maxDevices}
                onChange={(event) => setMaxDevices(Number(event.target.value))}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="expiresAt" className={styles.label}>Expires At (optional)</label>
              <div className={styles.presetRow}>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${selectedPreset === '1h' ? styles.presetBtnActive : ''}`}
                  onClick={() => applyExpiryPreset('1h')}
                  disabled={loading}
                >
                  1h
                </button>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${selectedPreset === '24h' ? styles.presetBtnActive : ''}`}
                  onClick={() => applyExpiryPreset('24h')}
                  disabled={loading}
                >
                  24h
                </button>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${selectedPreset === '7d' ? styles.presetBtnActive : ''}`}
                  onClick={() => applyExpiryPreset('7d')}
                  disabled={loading}
                >
                  7d
                </button>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${selectedPreset === '30d' ? styles.presetBtnActive : ''}`}
                  onClick={() => applyExpiryPreset('30d')}
                  disabled={loading}
                >
                  30d
                </button>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${selectedPreset === 'never' ? styles.presetBtnActive : ''}`}
                  onClick={() => applyExpiryPreset('never')}
                  disabled={loading}
                >
                  Never
                </button>
              </div>
              <input
                id="expiresAt"
                type="datetime-local"
                className={styles.input}
                value={expiresAt}
                onChange={(event) => {
                  setExpiresAt(event.target.value);
                  setSelectedPreset('never');
                }}
              />
            </div>

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Creating...' : 'Create License'}
            </button>

            {message ? (
              <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
                {message}
              </p>
            ) : null}
          </form>
        </section>
      </section>
    </main>
  );
}
