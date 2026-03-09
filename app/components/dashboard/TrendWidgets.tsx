'use client';

import { useMemo } from 'react';
import { toManilaDayKey } from './format';
import styles from './dashboard.module.css';
import type { AuthLogRow, LicenseRow } from './types';

type Props = {
  licenses: LicenseRow[];
  logs: AuthLogRow[];
  referenceTime: number;
};

type Point = {
  label: string;
  value: number;
};

function buildLastNDaySeries(labels: string[], counts: Map<string, number>): Point[] {
  return labels.map((label) => ({ label, value: counts.get(label) || 0 }));
}

function percent(approved: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((approved / total) * 100);
}

function buildPolyline(points: Point[]) {
  if (!points.length) {
    return '';
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - (point.value / max) * 100;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function TrendWidgets({ licenses, logs, referenceTime }: Props) {
  const { growthSeries, authSeries, approvalRate, totalAttempts } = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      days.push(toManilaDayKey(referenceTime - i * 24 * 60 * 60 * 1000));
    }

    const licenseCounts = new Map<string, number>();
    for (const license of licenses) {
      const day = toManilaDayKey(license.created_at);
      licenseCounts.set(day, (licenseCounts.get(day) || 0) + 1);
    }

    const authCounts = new Map<string, { approved: number; total: number }>();
    for (const log of logs) {
      const day = toManilaDayKey(log.created_at);
      const current = authCounts.get(day) || { approved: 0, total: 0 };
      current.total += 1;
      if (log.result === 'approved') {
        current.approved += 1;
      }
      authCounts.set(day, current);
    }

    const growth = buildLastNDaySeries(days, licenseCounts);
    const auth = days.map((day) => {
      const info = authCounts.get(day) || { approved: 0, total: 0 };
      return { label: day, value: percent(info.approved, info.total) };
    });

    const approvedTotal = logs.filter((log) => log.result === 'approved').length;
    return {
      growthSeries: growth,
      authSeries: auth,
      approvalRate: percent(approvedTotal, logs.length),
      totalAttempts: logs.length,
    };
  }, [licenses, logs, referenceTime]);

  const growthLine = buildPolyline(growthSeries);
  const authLine = buildPolyline(authSeries);
  const totalNewLicenses = growthSeries.reduce((sum, point) => sum + point.value, 0);
  const avgApproval = authSeries.length
    ? Math.round(authSeries.reduce((sum, point) => sum + point.value, 0) / authSeries.length)
    : 0;

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Performance Pulse</h2>
        <span className={styles.metaPill}>Last 7 days</span>
      </div>
      <div className={styles.chartsGrid}>
        <article className={styles.chartCard}>
          <p className={styles.chartEyebrow}>License Growth</p>
          <p className={styles.chartValue}>{totalNewLicenses}</p>
          <p className={styles.chartHint}>new licenses issued in last 7 days</p>
          <div className={styles.sparkWrap}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.spark}>
              <polyline points={growthLine} className={styles.sparkLinePrimary} />
            </svg>
          </div>
        </article>
        <article className={styles.chartCard}>
          <p className={styles.chartEyebrow}>Approval Rate</p>
          <p className={styles.chartValue}>{approvalRate}%</p>
          <p className={styles.chartHint}>
            {avgApproval}% avg daily approval, {totalAttempts} attempts sampled
          </p>
          <div className={styles.sparkWrap}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.spark}>
              <polyline points={authLine} className={styles.sparkLineAccent} />
            </svg>
          </div>
        </article>
      </div>
    </section>
  );
}
