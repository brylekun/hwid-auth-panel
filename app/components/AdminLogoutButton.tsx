'use client';

import { useRouter } from 'next/navigation';

export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid #333',
        background: '#111',
        cursor: 'pointer',
      }}
    >
      Logout
    </button>
  );
}
