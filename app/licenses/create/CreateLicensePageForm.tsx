'use client';

import Link from 'next/link';
import { useState } from 'react';
import AdminLogoutButton from '@/app/components/AdminLogoutButton';
import styles from './create-license.module.css';

function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () =>
    Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}

export default function CreateLicensePageForm() {
  const [licenseKey, setLicenseKey] = useState(generateLicenseKey());
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

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

      setMessage('License created successfully.');
      setMessageType('success');
      setLicenseKey(generateLicenseKey());
      setMaxDevices(1);
      setExpiresAt('');
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
          <p className={styles.eyebrow}>License Studio</p>
          <h1 className={styles.title}>Issue New HWID License</h1>
          <p className={styles.subtitle}>
            Create production-ready license keys with limits and optional expiration in one secure flow.
          </p>
          <ul className={styles.tips}>
            <li className={styles.tip}>Use generated keys to avoid collisions and typo mistakes.</li>
            <li className={styles.tip}>Set max devices by plan to protect account sharing.</li>
            <li className={styles.tip}>Use expiry for trials and time-limited subscriptions.</li>
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
              <input
                id="expiresAt"
                type="datetime-local"
                className={styles.input}
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
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
