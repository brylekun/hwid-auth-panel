'use client';

export default function ResetDeviceButton({ deviceId }: { deviceId: string }) {
  async function resetDevice() {
    if (!confirm('Reset this device?')) return;

    await fetch('/api/admin/reset-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    });

    window.location.reload();
  }

  return (
    <button
      onClick={resetDevice}
      style={{
        padding: '6px 10px',
        borderRadius: '6px',
        cursor: 'pointer'
      }}
    >
      Reset
    </button>
  );
}