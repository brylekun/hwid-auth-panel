'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage(data.message || 'Login failed');
        return;
      }

      const nextPath = searchParams.get('next') || '/';
      router.replace(nextPath);
      router.refresh();
    } catch {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', maxWidth: '360px' }}>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        style={inputStyle}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        style={inputStyle}
        required
      />
      <button type="submit" style={buttonStyle} disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      {message ? <p style={{ color: '#ff9a9a', margin: 0 }}>{message}</p> : null}
    </form>
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
