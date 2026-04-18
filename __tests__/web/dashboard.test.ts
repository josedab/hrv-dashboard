import {
  buildDashboardSummary,
  buildTrendSeries,
  buildPdfReportData,
  renderReportHtml,
} from '../../src/experimental/web/dashboard';
import { Session } from '../../src/types';

function makeSession(
  daysAgo: number,
  rmssd: number,
  source: 'chest_strap' | 'camera' = 'chest_strap'
): Session {
  const ts = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return {
    id: `s-${daysAgo}-${rmssd}`,
    timestamp: ts,
    durationSeconds: 300,
    rrIntervals: [800],
    rmssd,
    sdnn: 25,
    meanHr: 60,
    pnn50: 10,
    artifactRate: 0,
    verdict: rmssd >= 50 ? 'go_hard' : rmssd >= 40 ? 'moderate' : 'rest',
    perceivedReadiness: null,
    trainingType: null,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source,
  };
}

describe('buildDashboardSummary', () => {
  it('counts sessions, days, and verdicts', () => {
    const sessions = [makeSession(0, 50), makeSession(1, 40), makeSession(2, 30)];
    const summary = buildDashboardSummary(sessions, 7);
    expect(summary.totalSessions).toBe(3);
    expect(summary.daysTracked).toBe(3);
    expect(summary.verdictDistribution.go_hard).toBe(1);
    expect(summary.verdictDistribution.moderate).toBe(1);
    expect(summary.verdictDistribution.rest).toBe(1);
  });

  it('excludes camera sessions from baseline', () => {
    const sessions = [
      makeSession(1, 50, 'chest_strap'),
      makeSession(2, 40, 'chest_strap'),
      makeSession(3, 100, 'camera'),
    ];
    const summary = buildDashboardSummary(sessions, 7);
    expect(summary.baseline.values).not.toContain(100);
  });

  it('returns empty summary for no sessions', () => {
    const summary = buildDashboardSummary([], 7);
    expect(summary.totalSessions).toBe(0);
    expect(summary.latestSession).toBeNull();
    expect(summary.currentStreakDays).toBe(0);
  });

  it('reports current streak for today + yesterday', () => {
    const summary = buildDashboardSummary([makeSession(0, 50), makeSession(1, 50)], 7);
    expect(summary.currentStreakDays).toBeGreaterThanOrEqual(2);
  });
});

describe('buildTrendSeries', () => {
  it('emits one point per session in chronological order', () => {
    const sessions = [makeSession(2, 40), makeSession(1, 50), makeSession(0, 60)];
    const trend = buildTrendSeries(sessions, 7);
    expect(trend).toHaveLength(3);
    expect(trend[0].date <= trend[1].date).toBe(true);
    expect(trend[1].date <= trend[2].date).toBe(true);
  });

  it('computes baselineRatio against historical points only', () => {
    const sessions: Session[] = [];
    for (let d = 6; d >= 0; d--) sessions.push(makeSession(d, 50));
    const trend = buildTrendSeries(sessions, 7);
    // First point has no history → null
    expect(trend[0].baselineRatio).toBeNull();
    // Later points should be ~1.0 against a flat baseline
    expect(trend[trend.length - 1].baselineRatio).toBeCloseTo(1, 1);
  });
});

describe('buildPdfReportData + renderReportHtml', () => {
  it('produces a valid HTML document with the athlete name', () => {
    const sessions = [makeSession(0, 50)];
    const report = buildPdfReportData(sessions, 'Jose', 7);
    const html = renderReportHtml(report);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Jose');
    expect(html).toContain('Verdict distribution');
  });

  it('escapes HTML metacharacters in athlete name', () => {
    const report = buildPdfReportData([], '<script>', 7);
    const html = renderReportHtml(report);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('defaults athlete name when blank', () => {
    const report = buildPdfReportData([], '   ', 7);
    expect(report.athleteName).toBe('Athlete');
  });
});
