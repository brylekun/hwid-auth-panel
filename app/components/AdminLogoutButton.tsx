'use client';

import { useRouter } from 'next/navigation';
import styles from './dashboard/dashboard.module.css';

export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className={styles.btn}>
      Logout
    </button>
  );
}
