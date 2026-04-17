'use client';

import { useState } from 'react';
import { loadBackup, AthleteSummary } from '../lib/loadBackup';

export default function HomePage() {
  const [athletes, setAthletes] = useState<AthleteSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const summary = await loadBackup(text);
      setAthletes(summary);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>HRV Coach</h1>
      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        Drop an athlete's <code>.hrvbak</code> backup to view their last
        30-day readiness summary. Everything decrypts in your browser —
        no server upload.
      </p>

      <input type="file" accept=".hrvbak,.json" onChange={onFile} />
      {error && <p style={{ color: '#EF4444', marginTop: 16 }}>Error: {error}</p>}

      <table style={{ width: '100%', marginTop: 32, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #334155' }}>
            <th style={th}>Athlete</th>
            <th style={th}>Sessions</th>
            <th style={th}>Streak</th>
            <th style={th}>Baseline rMSSD</th>
            <th style={th}>Latest Verdict</th>
          </tr>
        </thead>
        <tbody>
          {athletes.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #1E293B' }}>
              <td style={td}>{a.name}</td>
              <td style={td}>{a.totalSessions}</td>
              <td style={td}>{a.currentStreakDays}d</td>
              <td style={td}>{a.baselineMedian.toFixed(1)} ms</td>
              <td style={{ ...td, color: verdictColor(a.latestVerdict) }}>
                {a.latestVerdict ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px' };

function verdictColor(v: string | null): string {
  if (v === 'go_hard') return '#22C55E';
  if (v === 'moderate') return '#F59E0B';
  if (v === 'rest') return '#EF4444';
  return '#94A3B8';
}
