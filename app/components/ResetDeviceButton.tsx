'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import styles from './dashboard/dashboard.module.css';

type Props = {
  deviceId: string;
  hwidHash?: string;
  onReset: (payload: { deviceId: string; hwidHash?: string }) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

export default function ResetDeviceButton({ deviceId, hwidHash, onReset, pushToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function resetDevice() {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, hwidHash }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to reset device', 'error');
        return;
      }

      onReset({ deviceId, hwidHash });
      pushToast('Device reset successfully');
    } catch {
      pushToast('Network error while resetting device', 'error');
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
          className={styles.btnDangerSmall}
        disabled={loading}
      >
        <span className={styles.btnInline}>
          <RotateCcw size={15} strokeWidth={2} />
          {loading ? 'Resetting...' : 'Reset Device'}
        </span>
      </button>

      {confirmOpen ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => !loading && setConfirmOpen(false)}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Reset Device</h3>
            <p className={styles.modalText}>
              Remove all bindings for this HWID across license history? The next validation may bind again if allowed.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.btnDanger}
                onClick={resetDevice}
                disabled={loading}
              >
                <span className={styles.btnInline}>
                  <RotateCcw size={15} strokeWidth={2} />
                  {loading ? 'Resetting...' : 'Confirm Reset'}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
