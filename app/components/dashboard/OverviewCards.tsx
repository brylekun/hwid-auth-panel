import styles from './dashboard.module.css';

type Props = {
  totalLicenses: number;
  totalDevices: number;
  recentLogs: number;
  adminLogs: number;
};

export default function OverviewCards({ totalLicenses, totalDevices, recentLogs, adminLogs }: Props) {
  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Overview</h2>
      </div>
      <div className={styles.cards}>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Total Licenses</p>
          <p className={styles.metricValue}>{totalLicenses}</p>
          <p className={styles.metricHint}>All issued license records</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Bound Devices</p>
          <p className={styles.metricValue}>{totalDevices}</p>
          <p className={styles.metricHint}>Current active hardware bindings</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Recent Logs</p>
          <p className={styles.metricValue}>{recentLogs}</p>
          <p className={styles.metricHint}>Latest auth attempts captured</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Admin Logs</p>
          <p className={styles.metricValue}>{adminLogs}</p>
          <p className={styles.metricHint}>Audited admin actions</p>
        </article>
      </div>
    </section>
  );
}
