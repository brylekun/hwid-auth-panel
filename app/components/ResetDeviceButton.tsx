'use client';

import { useState } from 'react';
import styles from './dashboard/dashboard.module.css';

type Props = {
  deviceId: string;
  onReset: (deviceId: string) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

export default function ResetDeviceButton({ deviceId, onReset, pushToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function resetDevice() {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to reset device', 'error');
        return;
      }

      onReset(deviceId);
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
      <button onClick={() => setConfirmOpen(true)} className={styles.btnGhost} disabled={loading}>
        {loading ? 'Resetting...' : 'Reset'}
      </button>
      {confirmOpen ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => !loading && setConfirmOpen(false)}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3 className={styles.modalTitle}>Reset Device</h3>
            <p className={styles.modalText}>
              Remove this device binding from the license? The next validation may bind again if allowed.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setConfirmOpen(false)} disabled={loading}>
                Cancel
              </button>
              <button className={styles.btnDanger} onClick={resetDevice} disabled={loading}>
                {loading ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
