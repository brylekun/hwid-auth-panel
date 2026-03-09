'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './dashboard/dashboard.module.css';

type Props = {
  className?: string;
  showIcon?: boolean;
};

export default function AdminLogoutButton({ className, showIcon = false }: Props) {
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
    <button type="button" onClick={handleLogout} className={className || styles.btn}>
      {showIcon ? (
        <span className={styles.btnInline}>
          <LogOut size={15} strokeWidth={2} />
          Logout
        </span>
      ) : (
        'Logout'
      )}
    </button>
  );
}
