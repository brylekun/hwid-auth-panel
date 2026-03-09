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
          <p className={styles.eyebrow}>Secure Access</p>
          <h1 className={styles.title}>HWID License Operations Dashboard</h1>
          <p className={styles.subtitle}>
            Centralized control for license management, device bindings, and real-time auth outcomes.
          </p>
          <ul className={styles.list}>
            <li className={styles.item}>Fine-grained device reset controls</li>
            <li className={styles.item}>Validation logs with quick filtering</li>
            <li className={styles.item}>Admin session protection with HttpOnly cookies</li>
          </ul>
        </aside>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Admin Sign In</h2>
          <p className={styles.cardText}>Use your panel credentials to continue.</p>
          <AdminLoginForm configError={hasConfigError} />
        </section>
      </section>
    </main>
  );
}
