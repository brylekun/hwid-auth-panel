'use client';

import { useState } from 'react';
import type { LicenseRow } from './dashboard/types';
import styles from './dashboard/dashboard.module.css';

type Props = {
  onCreated: (license: LicenseRow) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

export default function CreateLicenseForm({ onCreated, pushToast }: Props) {
  const [licenseKey, setLicenseKey] = useState('');
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

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

      if (data.success) {
        onCreated(data.license);
        pushToast('License created successfully');
        setLicenseKey('');
        setMaxDevices(1);
        setExpiresAt('');
      } else {
        pushToast(data.message || 'Failed to create license', 'error');
      }
    } catch {
      pushToast('Network error while creating license', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Create License</h2>
      </div>
      <form onSubmit={handleSubmit} className={styles.formGrid}>
        <input
          type="text"
          placeholder="License key"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          className={styles.input}
          required
        />
        <input
          type="number"
          min="1"
          value={maxDevices}
          onChange={(e) => setMaxDevices(Number(e.target.value))}
          className={styles.input}
        />
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className={styles.input}
        />
        <button type="submit" className={styles.btn} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create License'}
        </button>
      </form>
    </section>
  );
}
