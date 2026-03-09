'use client';

import { useState } from 'react';

export default function CreateLicenseForm() {
  const [licenseKey, setLicenseKey] = useState('');
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [result, setResult] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult('Creating...');

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
      setResult('License created successfully');
      setLicenseKey('');
      setMaxDevices(1);
      setExpiresAt('');
      window.location.reload();
    } else {
      setResult(data.message || 'Failed to create license');
    }
  }

  return (
    <section style={{ marginBottom: '32px' }}>
      <h2>Create License</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', maxWidth: '420px' }}>
        <input
          type="text"
          placeholder="License key"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          style={inputStyle}
          required
        />
        <input
          type="number"
          min="1"
          value={maxDevices}
          onChange={(e) => setMaxDevices(Number(e.target.value))}
          style={inputStyle}
        />
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          style={inputStyle}
        />
        <button type="submit" style={buttonStyle}>Create License</button>
      </form>
      {result && <p style={{ marginTop: '10px' }}>{result}</p>}
    </section>
  );
}

const inputStyle = {
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #333',
  background: '#111',
  color: 'white',
};

const buttonStyle = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
};