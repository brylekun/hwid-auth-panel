'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck, User } from 'lucide-react';
import styles from '../login/login.module.css';

type Props = {
  configError?: boolean;
};

type LoginToast = {
  id: number;
  message: string;
  type: 'success' | 'error';
};

export default function AdminLoginForm({ configError = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [toasts, setToasts] = useState<LoginToast[]>([]);
  const [loading, setLoading] = useState(false);

  function pushToast(messageText: string, type: 'success' | 'error') {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message: messageText, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }

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
        const errorMessage = data.message || 'Login failed';
        setMessage(errorMessage);
        pushToast(errorMessage, 'error');
        return;
      }

      pushToast(data.message || 'Login successful', 'success');
      const nextPath = searchParams.get('next') || '/';
      await new Promise((resolve) => setTimeout(resolve, 700));
      router.replace(nextPath);
      router.refresh();
    } catch {
      setMessage('Network error');
      pushToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formMeta}>
        <span className={styles.formMetaPill}>
          <ShieldCheck size={14} strokeWidth={2} />
          Protected Session
        </span>
      </div>

      {configError ? (
        <p className={styles.configError}>
          <AlertTriangle size={16} strokeWidth={2} className={styles.messageIcon} />
          <span>
            Admin auth is not configured. Set <code>ADMIN_PANEL_PASSWORD</code> in environment variables.
          </span>
        </p>
      ) : null}

      <div>
        <label className={styles.label} htmlFor="username">
          Username
        </label>

        <div className={styles.inputWrap}>
          <span className={styles.inputIcon} aria-hidden="true">
            <User size={18} strokeWidth={2} />
          </span>

          <input
            id="username"
            type="text"
            placeholder="Enter admin username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={`${styles.input} ${styles.inputWithIcon}`}
            required
            autoComplete="username"
          />
        </div>
      </div>

      <div>
        <label className={styles.label} htmlFor="password">
          Password
        </label>

        <div className={styles.passwordWrap}>
          <span className={styles.inputIcon} aria-hidden="true">
            <LockKeyhole size={18} strokeWidth={2} />
          </span>

          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${styles.input} ${styles.inputWithIcon} ${styles.inputWithAction}`}
            required
            autoComplete="current-password"
          />

          <button
            type="button"
            className={styles.passwordBtn}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
          </button>
        </div>
      </div>

      <button type="submit" className={styles.submit} disabled={loading}>
        <span className={styles.submitInner}>
          <ShieldCheck size={17} strokeWidth={2} />
          {loading ? 'Signing in...' : 'Sign In'}
        </span>
      </button>

      {message ? (
        <p className={styles.error}>
          <AlertTriangle size={16} strokeWidth={2} className={styles.messageIcon} />
          <span>{message}</span>
        </p>
      ) : null}

      <div className={styles.toastViewport} aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
          >
            <span className={styles.toastIcon}>
              {toast.type === 'success' ? (
                <CheckCircle2 size={16} strokeWidth={2} />
              ) : (
                <AlertTriangle size={16} strokeWidth={2} />
              )}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </form>
  );
}
