import AdminLoginForm from '../components/AdminLoginForm';
import { Activity, KeyRound, ShieldCheck } from 'lucide-react';
import styles from './login.module.css';

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const features = [
  {
    icon: KeyRound,
    text: 'Manage and authorize HWID bindings for Thunder Tool users',
  },
  {
    icon: Activity,
    text: 'Real-time authentication logs and validation monitoring',
  },
  {
    icon: ShieldCheck,
    text: 'Secure admin access with protected session management',
  },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const hasConfigError = resolvedSearchParams.error === 'config';

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.showcase}>
          <p className={styles.eyebrow}>Secure HWID Authentication</p>

          <h1 className={styles.title}>ThunderTool HWID Panel</h1>

          <p className={styles.subtitle}>
            A centralized management panel for Thunder Tool&apos;s ImGui menu authentication
            system. Manage licenses, bind hardware IDs, and monitor real-time authorization
            activity through a secure and streamlined dashboard.
          </p>

          <div className={styles.showcaseMeta}>
            <span className={styles.metaPill}>Session Protected</span>
            <span className={styles.metaPill}>HWID Control Center</span>
          </div>

          <ul className={styles.list}>
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <li key={feature.text} className={styles.item}>
                  <span className={styles.itemIconWrap}>
                    <Icon size={18} strokeWidth={2} className={styles.itemIcon} />
                  </span>
                  <span>{feature.text}</span>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className={styles.card}>
          <div className={styles.cardTop}>
            <p className={styles.cardEyebrow}>Administrator Access</p>
            <h2 className={styles.cardTitle}>Admin Login</h2>
            <p className={styles.cardText}>
              Sign in with your administrator credentials to access the Thunder Tool control panel.
            </p>
          </div>

          <AdminLoginForm configError={hasConfigError} />
        </section>
      </section>
    </main>
  );
}