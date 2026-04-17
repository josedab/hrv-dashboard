/**
 * Athlete detail page — renders a 30-day verdict heatmap.
 *
 * The actual session source plugs in via the same loadBackup flow as
 * the home page; for now the page expects sessions to be cached in
 * sessionStorage by athlete id. (TODO: replace with proper state mgmt
 * when multi-athlete drill-down lands.)
 */
'use client';

import { useEffect, useState } from 'react';
import { Session } from '../../../../src/types';
import { buildHeatmap, verdictColor, HeatmapGrid } from '../../../lib/heatmap';

interface PageProps {
  params: { id: string };
}

export default function AthletePage({ params }: PageProps) {
  const [grid, setGrid] = useState<HeatmapGrid | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(`athlete:${params.id}:sessions`);
      if (!raw) return;
      const sessions = JSON.parse(raw) as Session[];
      setGrid(buildHeatmap(sessions));
    } catch {
      setGrid(null);
    }
  }, [params.id]);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 32, color: '#F8FAFC' }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Athlete {params.id}</h1>
      <p style={{ opacity: 0.7, marginBottom: 24 }}>30-day readiness heatmap</p>

      {!grid && <p>No data cached for this athlete. Load a backup on the home page first.</p>}

      {grid && (
        <div role="grid" aria-label="readiness heatmap">
          {grid.weeks.map((week, y) => (
            <div key={y} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date} — ${cell.verdict ?? 'no reading'} (rMSSD ${cell.rmssd?.toFixed(1) ?? '—'})`}
                  style={{
                    width: 24,
                    height: 24,
                    background: verdictColor(cell.verdict),
                    borderRadius: 4,
                    opacity: cell.rmssd === null ? 0.35 : 1,
                  }}
                />
              ))}
            </div>
          ))}
          <p style={{ marginTop: 16, fontSize: 12, opacity: 0.6 }}>
            {grid.start} → {grid.end}
          </p>
        </div>
      )}
    </main>
  );
}
