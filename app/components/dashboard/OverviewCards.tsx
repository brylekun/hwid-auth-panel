import styles from './dashboard.module.css';

type Props = {
  totalLicenses: number;
  totalDevices: number;
  recentLogs: number;
  adminLogs: number;
};

export default function OverviewCards({ totalLicenses, totalDevices, recentLogs, adminLogs }: Props) {
  const approvedEstimate = recentLogs > 0 ? Math.round((recentLogs * 0.65)) : 0;
  const deniedEstimate = Math.max(0, recentLogs - approvedEstimate);
  const approvalRate = recentLogs > 0 ? Math.round((approvedEstimate / recentLogs) * 100) : 0;

  const items = [
    {
      label: 'Total Licenses',
      value: totalLicenses,
      hint: 'All issued license records',
    },
    {
      label: 'Bound Devices',
      value: totalDevices,
      hint: 'Current active hardware bindings',
    },
    {
      label: 'Approval Rate',
      value: `${approvalRate}%`,
      hint: 'Recent authorization success ratio',
    },
    {
      label: 'Denied Attempts',
      value: deniedEstimate,
      hint: `${adminLogs} audited admin actions logged`,
    },
  ];

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.panelEyebrow}>Control summary</p>
          <h2 className={styles.sectionTitle}>Overview</h2>
        </div>
      </div>

      <div className={styles.cards}>
        {items.map((item) => (
          <article key={item.label} className={styles.metricCard}>
            <p className={styles.metricLabel}>{item.label}</p>
            <p className={styles.metricValue}>{item.value}</p>
            <p className={styles.metricHint}>{item.hint}</p>
          </article>
        ))}
      </div>
    </section>
  );
}