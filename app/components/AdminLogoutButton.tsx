'use client';

import { useRouter } from 'next/navigation';
import styles from './dashboard/dashboard.module.css';

export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } finally {
      window.location.href = '/login';
      router.refresh();
    }
  }

  return (
    <button onClick={handleLogout} className={styles.btn}>
      Logout
    </button>
  );
}
