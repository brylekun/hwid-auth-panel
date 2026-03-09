import AdminLoginForm from '../components/AdminLoginForm';
import styles from './login.module.css';

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const hasConfigError = resolvedSearchParams.error === 'config';

return (
  <main className={styles.page}>
    <section className={styles.shell}>
      <aside className={styles.showcase}>
        <p className={styles.eyebrow}>Secure HWID Authentication</p>
        <h1 className={styles.title}>Thunder Tool HWID Panel</h1>
        <p className={styles.subtitle}>
          A centralized management panel for Thunder Tool&apos;s ImGui menu authentication system. 
          Manage licenses, bind hardware IDs, and monitor real-time authorization activity 
          through a secure and streamlined dashboard.
        </p>
        <ul className={styles.list}>
          <li className={styles.item}>Manage and authorize HWID bindings for Thunder Tool users</li>
          <li className={styles.item}>Real-time authentication logs and validation monitoring</li>
          <li className={styles.item}>Secure admin access with protected session management</li>
        </ul>
      </aside>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Admin Login</h2>
        <p className={styles.cardText}>
          Sign in with your administrator credentials to access the Thunder Tool control panel.
        </p>
        <AdminLoginForm configError={hasConfigError} />
      </section>
    </section>
  </main>
);
}
