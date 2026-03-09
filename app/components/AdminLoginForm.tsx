'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import styles from '../login/login.module.css';

type Props = {
  configError?: boolean;
};

export default function AdminLoginForm({ configError = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <form onSubmit={handleSubmit} className={styles.form}>
      {configError ? (
        <p className={styles.configError}>
          Admin auth is not configured. Set <code>ADMIN_PANEL_PASSWORD</code> in environment variables.
        </p>
      ) : null}
      <div>
        <label className={styles.label} htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          placeholder="Enter admin username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className={styles.input}
          required
          autoComplete="username"
        />
      </div>
      <div>
        <label className={styles.label} htmlFor="password">Password</label>
        <div className={styles.passwordWrap}>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={styles.input}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className={styles.passwordBtn}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
      {message ? <p className={styles.error}>{message}</p> : null}
    </form>
  );
}
