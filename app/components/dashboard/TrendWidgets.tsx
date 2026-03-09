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
  if (!total) return 0;
  return Math.round((approved / total) * 100);
}

function buildPolyline(points: Point[]) {
  if (!points.length) return '';

  const max = Math.max(...points.map((p) => p.value), 1);

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - (point.value / max) * 100;
      return `${x},${y}`;
    })
    .join(' ');
}

function buildArea(points: Point[]) {
  if (!points.length) return '';

  const line = buildPolyline(points);
  return `0,100 ${line} 100,100`;
}

function shortDayLabel(dayKey: string) {
  const [, month, day] = dayKey.split('-');
  return `${month}/${day}`;
}

export default function TrendWidgets({ licenses, logs, referenceTime }: Props) {
  const {
    growthSeries,
    authSeries,
    approvalRate,
    totalAttempts,
    approvedTotal,
    deniedTotal,
  } = useMemo(() => {
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

    const approved = logs.filter((log) => log.result === 'approved').length;
    const denied = Math.max(0, logs.length - approved);

    return {
      growthSeries: growth,
      authSeries: auth,
      approvalRate: percent(approved, logs.length),
      totalAttempts: logs.length,
      approvedTotal: approved,
      deniedTotal: denied,
    };
  }, [licenses, logs, referenceTime]);

  const growthLine = buildPolyline(growthSeries);
  const authLine = buildPolyline(authSeries);
  const growthArea = buildArea(growthSeries);
  const authArea = buildArea(authSeries);

  const totalNewLicenses = growthSeries.reduce((sum, point) => sum + point.value, 0);
  const bestGrowthDay = Math.max(...growthSeries.map((point) => point.value), 0);
  const avgApproval = authSeries.length
    ? Math.round(authSeries.reduce((sum, point) => sum + point.value, 0) / authSeries.length)
    : 0;

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.panelEyebrow}>Activity intelligence</p>
          <h2 className={styles.sectionTitle}>Performance Pulse</h2>
        </div>
        <span className={styles.metaPill}>Last 7 days</span>
      </div>

      <div className={styles.chartsGrid}>
        <article className={styles.chartCard}>
          <div className={styles.chartHead}>
            <div>
              <p className={styles.chartEyebrow}>License Growth</p>
              <p className={styles.chartValue}>{totalNewLicenses}</p>
            </div>
            <div className={styles.chartSideStat}>
              <span className={styles.chartSideLabel}>Peak Day</span>
              <strong className={styles.chartSideValue}>{bestGrowthDay}</strong>
            </div>
          </div>

          <p className={styles.chartHint}>New licenses issued across the last 7 days</p>

          <div className={styles.sparkWrap}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.spark}>
              <polygon points={growthArea} className={styles.sparkAreaPrimary} />
              <polyline points={growthLine} className={styles.sparkLinePrimary} />
            </svg>
          </div>

          <div className={styles.sparkLabels}>
            {growthSeries.map((point) => (
              <span key={point.label} className={styles.sparkLabel}>
                {shortDayLabel(point.label)}
              </span>
            ))}
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.chartHead}>
            <div>
              <p className={styles.chartEyebrow}>Approval Rate</p>
              <p className={styles.chartValue}>{approvalRate}%</p>
            </div>
            <div className={styles.chartSideStat}>
              <span className={styles.chartSideLabel}>Denied</span>
              <strong className={styles.chartSideValue}>{deniedTotal}</strong>
            </div>
          </div>

          <p className={styles.chartHint}>
            {avgApproval}% avg daily approval across {totalAttempts} validation attempts
          </p>

          <div className={styles.sparkWrap}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.spark}>
              <polygon points={authArea} className={styles.sparkAreaAccent} />
              <polyline points={authLine} className={styles.sparkLineAccent} />
            </svg>
          </div>

          <div className={styles.chartFooterMeta}>
            <span className={styles.chartFooterItem}>Approved: {approvedTotal}</span>
            <span className={styles.chartFooterItem}>Denied: {deniedTotal}</span>
          </div>
        </article>
      </div>
    </section>
  );
}