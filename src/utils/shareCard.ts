/**
 * Shareable readiness card generator.
 *
 * Produces a branded HTML card showing the user's verdict, trend, and
 * streak — designed to be rendered to an image and shared via native
 * share sheet. Privacy-safe: no raw rMSSD or RR data included.
 */
import { VerdictType } from '../types';

export interface ShareCardData {
  verdict: VerdictType | null;
  rmssdPercent: number;
  trendDirection: 'improving' | 'stable' | 'declining';
  trendPercent: number;
  streak: number;
  date: string;
}

const VERDICT_EMOJI: Record<string, string> = {
  go_hard: '🟢',
  moderate: '🟡',
  rest: '🔴',
};

const VERDICT_LABEL: Record<string, string> = {
  go_hard: 'Go Hard',
  moderate: 'Moderate',
  rest: 'Rest',
};

const VERDICT_BG: Record<string, string> = {
  go_hard: '#065F46',
  moderate: '#78350F',
  rest: '#7F1D1D',
};

const TREND_ARROW: Record<string, string> = {
  improving: '📈',
  stable: '➡️',
  declining: '📉',
};

/**
 * Generates a self-contained HTML card for rendering to image.
 * The card is 600×340px with dark theme matching the app.
 */
export function renderShareCardHtml(data: ShareCardData): string {
  const emoji = data.verdict ? VERDICT_EMOJI[data.verdict] : '⚪';
  const label = data.verdict ? VERDICT_LABEL[data.verdict] : 'Building Baseline';
  const bg = data.verdict ? VERDICT_BG[data.verdict] : '#1E293B';
  const arrow = TREND_ARROW[data.trendDirection];
  const trendText = !Number.isFinite(data.trendPercent)
    ? 'Stable'
    : data.trendDirection === 'improving'
      ? `+${Math.abs(data.trendPercent)}%`
      : data.trendDirection === 'declining'
        ? `-${Math.abs(data.trendPercent)}%`
        : 'Stable';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 600px; height: 340px; background: ${bg}; font-family: -apple-system, sans-serif; color: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 32px; }
  .emoji { font-size: 48px; margin-bottom: 8px; }
  .verdict { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
  .baseline { font-size: 16px; opacity: 0.8; margin-bottom: 24px; }
  .stats { display: flex; gap: 40px; margin-bottom: 24px; }
  .stat { text-align: center; }
  .stat-value { font-size: 22px; font-weight: 700; }
  .stat-label { font-size: 11px; opacity: 0.6; margin-top: 2px; }
  .footer { font-size: 11px; opacity: 0.4; }
</style></head>
<body>
  <div class="emoji">${emoji}</div>
  <div class="verdict">${label}</div>
  <div class="baseline">${data.rmssdPercent}% of baseline · ${data.date}</div>
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${arrow} ${trendText}</div>
      <div class="stat-label">Weekly Trend</div>
    </div>
    <div class="stat">
      <div class="stat-value">🔥 ${data.streak}</div>
      <div class="stat-label">Day Streak</div>
    </div>
  </div>
  <div class="footer">Tracked with HRV Readiness Dashboard</div>
</body>
</html>`;
}

/**
 * Generates a plain-text share message for platforms that don't support images.
 */
export function renderShareText(data: ShareCardData): string {
  const emoji = data.verdict ? VERDICT_EMOJI[data.verdict] : '⚪';
  const label = data.verdict ? VERDICT_LABEL[data.verdict] : 'Building Baseline';
  const arrow = TREND_ARROW[data.trendDirection];

  return [
    `${emoji} HRV Readiness — ${data.date}`,
    '',
    `Verdict: ${label} (${data.rmssdPercent}% of baseline)`,
    `Trend: ${arrow} ${data.trendDirection}`,
    data.streak >= 3 ? `🔥 ${data.streak}-day streak` : '',
    '',
    '— HRV Readiness Dashboard',
  ]
    .filter(Boolean)
    .join('\n');
}
