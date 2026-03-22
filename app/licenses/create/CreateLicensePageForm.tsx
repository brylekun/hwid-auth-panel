'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import AdminLogoutButton from '@/app/components/AdminLogoutButton';
import styles from './create-license.module.css';

type ExpiryPreset = '1h' | '24h' | '7d' | '30d' | 'never';
type Props = {
  embedded?: boolean;
};

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

export default function CreateLicensePageForm({ embedded = false }: Props) {
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
      preset === '1h'
        ? 60 * 60 * 1000
        : preset === '24h'
          ? 24 * 60 * 60 * 1000
          : preset === '7d'
            ? 7 * 24 * 60 * 60 * 1000
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

      router.replace('/licenses');
      router.refresh();
    } catch {
      setMessage('Network error while creating license');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <>
      <div className={styles.formMeta}>
        <span className={styles.formMetaPill}>
          <ShieldCheck size={14} strokeWidth={2} />
          Secure Provisioning
        </span>
      </div>

      <div className={styles.headerBlock}>
        <h2 className={styles.heading}>Create License</h2>
        <p className={styles.text}>
          Fill required fields and submit to provision a new hardware-bound license.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="licenseKey" className={styles.label}>
            License Key
          </label>

          <div className={styles.inputWrap}>
            <span className={styles.inputIcon} aria-hidden="true">
              <KeyRound size={18} strokeWidth={2} />
            </span>

            <div className={styles.inline}>
              <input
                id="licenseKey"
                className={`${styles.input} ${styles.inputWithIcon} ${styles.keyInput}`}
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
                <span className={styles.btnInner}>
                  <RefreshCw size={16} strokeWidth={2} />
                  Generate
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="maxDevices" className={styles.label}>
            Max Devices
          </label>

          <div className={styles.inputWrap}>
            <span className={styles.inputIcon} aria-hidden="true">
              <Smartphone size={18} strokeWidth={2} />
            </span>

            <input
              id="maxDevices"
              type="number"
              min={1}
              max={100}
              className={`${styles.input} ${styles.inputWithIcon}`}
              value={maxDevices}
              onChange={(event) => setMaxDevices(Number(event.target.value))}
              required
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="expiresAt" className={styles.label}>
            Expires At <span className={styles.labelMuted}>(optional, starts on first login)</span>
          </label>

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

          <div className={styles.inputWrap}>
            <span className={styles.inputIcon} aria-hidden="true">
              <CalendarClock size={18} strokeWidth={2} />
            </span>

            <input
              id="expiresAt"
              type="datetime-local"
              className={`${styles.input} ${styles.inputWithIcon}`}
              value={expiresAt}
              onChange={(event) => {
                setExpiresAt(event.target.value);
                setSelectedPreset('never');
              }}
            />
          </div>
        </div>

        <button type="submit" className={styles.submit} disabled={loading}>
          <span className={styles.btnInner}>
            <Sparkles size={17} strokeWidth={2} />
            {loading ? 'Creating...' : 'Create License'}
          </span>
        </button>

        {message ? (
          <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
            {message}
          </p>
        ) : null}
      </form>
    </>
  );

  if (embedded) {
    return <section className={styles.embedPanel}>{content}</section>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.showcase}>
          <p className={styles.eyebrow}>Thunder Tool Licensing</p>

          <h1 className={styles.title}>Create New HWID License</h1>

          <p className={styles.subtitle}>
            Generate secure license keys for Thunder Tool with configurable device limits and
            optional expiration settings. Manage HWID authentication and control user access
            through a reliable licensing workflow.
          </p>

          <div className={styles.showcaseMeta}>
            <span className={styles.metaPill}>License Provisioning</span>
            <span className={styles.metaPill}>Secure Issuance</span>
          </div>

          <ul className={styles.tips}>
            <li className={styles.tip}>
              Generate secure license keys automatically to reduce manual errors.
            </li>
            <li className={styles.tip}>
              Configure maximum HWID bindings to control sharing and device limits.
            </li>
            <li className={styles.tip}>
              Set expiration windows for trials, temporary access, or subscription plans.
            </li>
          </ul>
        </aside>

        <section className={styles.panel}>
          <div className={styles.topbar}>
            <Link href="/" className={styles.backLink}>
              <ChevronLeft size={16} strokeWidth={2} />
              Back to Dashboard
            </Link>
            <AdminLogoutButton />
          </div>

          {content}
        </section>
      </section>
    </main>
  );
}
