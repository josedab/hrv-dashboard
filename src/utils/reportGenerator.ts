/**
 * HTML report generator for HRV session data.
 *
 * Produces a self-contained HTML string with inline CSS that can be
 * rendered to PDF (via expo-print) or shared as an HTML file. Contains:
 *   - Summary KPI cards (avg rMSSD, sessions, streak, recovery)
 *   - Verdict distribution breakdown
 *   - rMSSD trend table (daily values)
 *   - Correlation highlights (sleep/stress vs HRV)
 */
import { Session, BaselineResult, VerdictType } from '../types';
import { computeMedian } from '../hrv/baseline';

/** Report time range: 'weekly' (last 7 days) or 'monthly' (current month). */
export type ReportPeriod = 'weekly' | 'monthly';

/** Aggregated data structure fed to {@link renderReportHtml}. */
export interface ReportData {
  title: string;
  periodLabel: string;
  generatedAt: string;
  sessions: Session[];
  baseline: BaselineResult;
  avgRmssd: number;
  medianRmssd: number;
  avgHr: number;
  verdictCounts: Record<VerdictType, number>;
  streak: number;
  dailyValues: { date: string; rmssd: number; verdict: VerdictType | null }[];
}

/**
 * Builds report data from sessions and baseline.
 */
export function buildReportData(
  sessions: Session[],
  baseline: BaselineResult,
  period: ReportPeriod,
  streak: number
): ReportData {
  const now = new Date();
  const periodLabel =
    period === 'weekly'
      ? `Week of ${formatDate(new Date(now.getTime() - 7 * 86_400_000))} – ${formatDate(now)}`
      : `${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;

  const rmssdValues = sessions.map((s) => s.rmssd);
  const avgRmssd =
    rmssdValues.length > 0 ? rmssdValues.reduce((a, b) => a + b, 0) / rmssdValues.length : 0;
  const medianRmssd = computeMedian(rmssdValues);
  const avgHr =
    sessions.length > 0 ? sessions.reduce((s, x) => s + x.meanHr, 0) / sessions.length : 0;

  const verdictCounts: Record<VerdictType, number> = { go_hard: 0, moderate: 0, rest: 0 };
  for (const s of sessions) {
    if (s.verdict) verdictCounts[s.verdict]++;
  }

  const dailyMap = new Map<string, Session>();
  for (const s of sessions) {
    const date = s.timestamp.slice(0, 10);
    if (!dailyMap.has(date)) dailyMap.set(date, s);
  }
  const dailyValues = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({ date, rmssd: s.rmssd, verdict: s.verdict }));

  return {
    title: `HRV Readiness Report`,
    periodLabel,
    generatedAt: now.toISOString(),
    sessions,
    baseline,
    avgRmssd: round1(avgRmssd),
    medianRmssd: round1(medianRmssd),
    avgHr: round1(avgHr),
    verdictCounts,
    streak,
    dailyValues,
  };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const VERDICT_COLORS: Record<VerdictType, string> = {
  go_hard: '#22C55E',
  moderate: '#F59E0B',
  rest: '#EF4444',
};

const VERDICT_LABELS: Record<VerdictType, string> = {
  go_hard: 'Go Hard',
  moderate: 'Moderate',
  rest: 'Rest',
};

/**
 * Renders a self-contained HTML report from report data.
 * Uses inline CSS — no external dependencies.
 */
export function renderReportHtml(data: ReportData): string {
  const verdictBars = (['go_hard', 'moderate', 'rest'] as VerdictType[])
    .map((v) => {
      const count = data.verdictCounts[v];
      const total = data.sessions.filter((s) => s.verdict !== null).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return `<div style="display:flex;align-items:center;margin:4px 0;">
        <span style="width:80px;font-size:13px;color:#666;">${VERDICT_LABELS[v]}</span>
        <div style="flex:1;background:#eee;border-radius:4px;height:20px;margin:0 8px;">
          <div style="width:${pct}%;background:${VERDICT_COLORS[v]};border-radius:4px;height:100%;min-width:${count > 0 ? '2px' : '0'};"></div>
        </div>
        <span style="font-size:13px;color:#333;width:50px;text-align:right;">${count} (${pct}%)</span>
      </div>`;
    })
    .join('\n');

  const dailyRows = data.dailyValues
    .map((d) => {
      const color = d.verdict ? VERDICT_COLORS[d.verdict] : '#94A3B8';
      const label = d.verdict ? VERDICT_LABELS[d.verdict] : '—';
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${d.date}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;">${d.rmssd.toFixed(1)} ms</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;"><span style="color:${color};font-weight:600;">${label}</span></td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${data.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; color: #1a1a1a; background: #fff; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 22px; margin: 0 0 4px; }
    .header p { color: #666; font-size: 13px; margin: 0; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
    .kpi .value { font-size: 28px; font-weight: 700; color: #1a1a1a; }
    .kpi .label { font-size: 12px; color: #666; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; margin: 0 0 12px; color: #333; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #ddd; font-size: 13px; color: #666; }
    .footer { text-align: center; color: #999; font-size: 11px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.title}</h1>
    <p>${data.periodLabel}</p>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="value">${data.avgRmssd}</div>
      <div class="label">Avg rMSSD (ms)</div>
    </div>
    <div class="kpi">
      <div class="value">${data.medianRmssd}</div>
      <div class="label">Median rMSSD (ms)</div>
    </div>
    <div class="kpi">
      <div class="value">${data.avgHr}</div>
      <div class="label">Avg HR (bpm)</div>
    </div>
    <div class="kpi">
      <div class="value">${data.sessions.length}</div>
      <div class="label">Sessions</div>
    </div>
    <div class="kpi">
      <div class="value">${data.baseline.median > 0 ? data.baseline.median.toFixed(1) : '—'}</div>
      <div class="label">Baseline (ms)</div>
    </div>
    <div class="kpi">
      <div class="value">${data.streak}</div>
      <div class="label">Day Streak</div>
    </div>
  </div>

  <div class="section">
    <h2>Verdict Distribution</h2>
    ${verdictBars}
  </div>

  <div class="section">
    <h2>Daily Values</h2>
    <table>
      <thead><tr><th>Date</th><th>rMSSD</th><th>Verdict</th></tr></thead>
      <tbody>${dailyRows}</tbody>
    </table>
  </div>

  <div class="footer">
    Generated by HRV Readiness Dashboard · ${data.generatedAt.slice(0, 10)}
  </div>
</body>
</html>`;
}
