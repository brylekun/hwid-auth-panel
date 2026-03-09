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

  async function resetDevice() {
    if (!confirm('Reset this device?')) return;

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
    }
  }

  return (
    <button onClick={resetDevice} className={styles.btnGhost} disabled={loading}>
      {loading ? 'Resetting...' : 'Reset'}
    </button>
  );
}
