/**
 * @experimental NOT YET SHIPPED — no production importer as of this writing.
 * See CLAUDE.md → "Experimental modules" before relying on this in app code.
 * Web dashboard view models.
 *
 * Pure-TypeScript adapters that turn raw `Session[]` into the shapes a
 * web dashboard (Next.js / static PWA) renders. Lives in the same
 * package as the mobile app so the HRV engine, baseline math, and
 * formatting stay byte-identical between phone and web.
 *
 * The web app loads an encrypted backup bundle (.hrvbak) in the browser,
 * decrypts it client-side using a WASM build of the same SHA-256 CTR
 * cipher, then feeds the decoded `Session[]` into these adapters.
 */
import { Session, BaselineResult, VerdictType } from '../../types';
import { computeBaseline } from '../../hrv/baseline';
import { computeWeeklySummary } from '../../hrv/analytics';

export interface DashboardSummary {
  totalSessions: number;
  daysTracked: number;
  currentStreakDays: number;
  baseline: BaselineResult;
  latestSession: Session | null;
  verdictDistribution: Record<VerdictType | 'pending', number>;
}

export interface TrendPoint {
  /** YYYY-MM-DD */
  date: string;
  rmssd: number;
  meanHr: number;
  verdict: VerdictType | null;
  /** Ratio against the rolling baseline at that date, or null. */
  baselineRatio: number | null;
}

export interface PdfReportData {
  generatedAt: string;
  athleteName: string;
  summary: DashboardSummary;
  trend: TrendPoint[];
  weekly: ReturnType<typeof computeWeeklySummary>;
  notes: string;
}

/** Builds the top-level summary card shown on the dashboard home. */
export function buildDashboardSummary(
  sessions: Session[],
  baselineWindowDays: number = 7
): DashboardSummary {
  const sorted = [...sessions].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const dailyReadings = sorted
    .filter((s) => s.source === 'chest_strap')
    .map((s) => ({
      date: s.timestamp.slice(0, 10),
      rmssd: s.rmssd,
      verdict: s.verdict,
    }));

  const baseline = computeBaseline(dailyReadings, baselineWindowDays);

  const verdictDistribution: DashboardSummary['verdictDistribution'] = {
    go_hard: 0,
    moderate: 0,
    rest: 0,
    pending: 0,
  };
  for (const s of sessions) {
    if (s.verdict) verdictDistribution[s.verdict]++;
    else verdictDistribution.pending++;
  }

  const days = new Set(sessions.map((s) => s.timestamp.slice(0, 10)));

  return {
    totalSessions: sessions.length,
    daysTracked: days.size,
    currentStreakDays: computeCurrentStreak([...days].sort()),
    baseline,
    latestSession: sorted[sorted.length - 1] ?? null,
    verdictDistribution,
  };
}

function computeCurrentStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  let cursor = fmt(today);
  let streak = 0;
  const dateSet = new Set(sortedDates);
  while (dateSet.has(cursor)) {
    streak++;
    const d = new Date(cursor + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = fmt(d);
  }
  return streak;
}

/**
 * Builds a per-day trend series with rolling baselines computed at each
 * point in time (so historical points reflect the baseline that *was*
 * known on that date, not the latest one).
 */
export function buildTrendSeries(
  sessions: Session[],
  baselineWindowDays: number = 7
): TrendPoint[] {
  const sorted = [...sessions].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const points: TrendPoint[] = [];
  const dailyHistory: { date: string; rmssd: number; verdict: VerdictType | null }[] = [];

  for (const s of sorted) {
    const date = s.timestamp.slice(0, 10);
    if (s.source === 'chest_strap') {
      dailyHistory.push({ date, rmssd: s.rmssd, verdict: s.verdict });
    }
    const baselineAtDate = computeBaselineAt(dailyHistory, date, baselineWindowDays);
    points.push({
      date,
      rmssd: s.rmssd,
      meanHr: s.meanHr,
      verdict: s.verdict,
      baselineRatio: baselineAtDate > 0 ? s.rmssd / baselineAtDate : null,
    });
  }

  return points;
}

function computeBaselineAt(
  dailyHistory: { date: string; rmssd: number }[],
  asOfDate: string,
  windowDays: number
): number {
  const asOf = new Date(asOfDate + 'T12:00:00');
  const cutoffDate = new Date(asOf);
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;
  const inWindow = dailyHistory
    .filter((d) => d.date >= cutoffStr && d.date < asOfDate)
    .map((d) => d.rmssd);
  if (inWindow.length === 0) return 0;
  const sorted = [...inWindow].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Bundles everything needed for a downloadable PDF report. */
export function buildPdfReportData(
  sessions: Session[],
  athleteName: string,
  baselineWindowDays: number = 7
): PdfReportData {
  const summary = buildDashboardSummary(sessions, baselineWindowDays);
  const trend = buildTrendSeries(sessions, baselineWindowDays);
  const weekCutoff = Date.now() - 7 * 86_400_000;
  const prevCutoff = Date.now() - 14 * 86_400_000;
  const current = sessions.filter((s) => Date.parse(s.timestamp) >= weekCutoff);
  const previous = sessions.filter(
    (s) => Date.parse(s.timestamp) >= prevCutoff && Date.parse(s.timestamp) < weekCutoff
  );
  const weekly = computeWeeklySummary(current, previous);

  return {
    generatedAt: new Date().toISOString(),
    athleteName: athleteName.trim() || 'Athlete',
    summary,
    trend,
    weekly,
    notes: '',
  };
}

/**
 * Renders the report data to a minimal, browser-renderable HTML string.
 * The web app pipes this through `window.print()` to get a PDF.
 * Kept dependency-free so it runs identically in Node tests.
 */
export function renderReportHtml(report: PdfReportData): string {
  const verdictRows = (
    Object.keys(report.summary.verdictDistribution) as Array<
      keyof typeof report.summary.verdictDistribution
    >
  )
    .map((k) => `<tr><td>${k}</td><td>${report.summary.verdictDistribution[k]}</td></tr>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HRV Report — ${escapeHtml(report.athleteName)}</title>
<style>body{font-family:-apple-system,sans-serif;margin:32px;color:#0F172A}h1{margin-bottom:4px}h2{margin-top:24px}table{border-collapse:collapse;margin-top:8px}td,th{padding:4px 12px;border-bottom:1px solid #ddd;text-align:left}</style></head><body>
<h1>HRV Readiness Report</h1>
<div>${escapeHtml(report.athleteName)} — generated ${escapeHtml(report.generatedAt)}</div>
<h2>Summary</h2>
<table>
<tr><td>Total sessions</td><td>${report.summary.totalSessions}</td></tr>
<tr><td>Days tracked</td><td>${report.summary.daysTracked}</td></tr>
<tr><td>Current streak</td><td>${report.summary.currentStreakDays} days</td></tr>
<tr><td>Baseline rMSSD</td><td>${report.summary.baseline.median.toFixed(1)} ms (${report.summary.baseline.dayCount} days)</td></tr>
</table>
<h2>Verdict distribution</h2>
<table><tr><th>Verdict</th><th>Count</th></tr>${verdictRows}</table>
<h2>Last 7 days</h2>
<table>
<tr><td>Avg rMSSD</td><td>${report.weekly.avgRmssd.toFixed(1)} ms</td></tr>
<tr><td>Median rMSSD</td><td>${report.weekly.medianRmssd.toFixed(1)} ms</td></tr>
<tr><td>Avg HR</td><td>${report.weekly.avgHr.toFixed(0)} bpm</td></tr>
<tr><td>Trend</td><td>${report.weekly.trendDirection} (${report.weekly.trendPercent.toFixed(1)}%)</td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
