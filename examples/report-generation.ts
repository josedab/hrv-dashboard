/**
 * Example: Generate an HTML readiness report.
 *
 * Builds a weekly summary report from session data and writes it
 * to an HTML file. In the mobile app this would be rendered to PDF
 * via expo-print.
 *
 * Run: npx ts-node examples/report-generation.ts
 */
import { buildReportData, renderReportHtml } from '../src/utils/reportGenerator';
import { Session, BaselineResult } from '../src/types';

// Simulated week of sessions
const sessions: Session[] = [
  makeSession('mon', '2026-04-07', 42.5, 'go_hard', 'Strength'),
  makeSession('tue', '2026-04-08', 38.0, 'moderate', 'BJJ'),
  makeSession('wed', '2026-04-09', 35.2, 'rest', 'Rest'),
  makeSession('thu', '2026-04-10', 44.1, 'go_hard', 'Cycling'),
  makeSession('fri', '2026-04-11', 40.8, 'moderate', 'Strength'),
  makeSession('sat', '2026-04-12', 46.3, 'go_hard', null),
  makeSession('sun', '2026-04-13', 43.0, 'go_hard', 'Rest'),
];

const baseline: BaselineResult = {
  median: 42.0,
  dayCount: 7,
  values: sessions.map((s) => s.rmssd),
};

console.log('=== Report Generation Example ===\n');

const data = buildReportData(sessions, baseline, 'weekly', 12);
const html = renderReportHtml(data);

console.log(`Report: "${data.title}"`);
console.log(`Period: ${data.periodLabel}`);
console.log(`Sessions: ${data.sessions.length}`);
console.log(`Avg rMSSD: ${data.avgRmssd} ms`);
console.log(
  `Verdicts: Go Hard ${data.verdictCounts.go_hard}, Moderate ${data.verdictCounts.moderate}, Rest ${data.verdictCounts.rest}`
);
console.log(`\nHTML length: ${html.length} characters`);
console.log(`Contains DOCTYPE: ${html.includes('<!DOCTYPE html>')}`);
console.log(`\nTo view the report, save the HTML output to a file:`);
console.log(`  npx ts-node examples/report-generation.ts > report.html && open report.html`);

function makeSession(
  id: string,
  date: string,
  rmssd: number,
  verdict: 'go_hard' | 'moderate' | 'rest',
  trainingType: string | null
): Session {
  return {
    id,
    timestamp: `${date}T06:30:00Z`,
    durationSeconds: 300,
    rrIntervals: [],
    rmssd,
    sdnn: rmssd * 0.5,
    meanHr: 62,
    pnn50: 20,
    artifactRate: 0.02,
    verdict,
    perceivedReadiness: null,
    trainingType,
    notes: null,
    sleepHours: null,
    sleepQuality: null,
    stressLevel: null,
    source: 'chest_strap',
  };
}
