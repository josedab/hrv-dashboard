import { planImport, commitImport } from '../../src/experimental/integrations/import/wizard';
import { Session } from '../../src/types';

const WHOOP_CSV = `Cycle start time,Heart rate variability (ms),Resting heart rate (bpm),Recovery score %
2026-04-10T07:00:00Z,55.2,52,82
2026-04-11T07:00:00Z,50.1,54,78
2026-04-12T07:00:00Z,48.5,55,70
`;

describe('import wizard', () => {
  it('plans a fresh import when no collisions', async () => {
    const preview = await planImport('whoop', WHOOP_CSV, async () => new Set());
    expect(preview.total).toBe(3);
    expect(preview.willInsert).toBe(3);
    expect(preview.collisions).toBe(0);
    expect(preview.parseErrors).toHaveLength(0);
  });

  it('detects collisions by ID', async () => {
    const fresh = await planImport('whoop', WHOOP_CSV, async () => new Set());
    const collidingId = fresh.sessions[0].id;
    const preview = await planImport('whoop', WHOOP_CSV, async () => new Set([collidingId]));
    expect(preview.willInsert).toBe(2);
    expect(preview.collisions).toBe(1);
    expect(preview.collisionIds).toContain(collidingId);
  });

  it('commit saves only fresh sessions and reports failures', async () => {
    const saved: Session[] = [];
    let calls = 0;
    const preview = await planImport('whoop', WHOOP_CSV, async () => new Set());
    const result = await commitImport(preview, async (s) => {
      calls += 1;
      if (calls === 3) throw new Error('boom');
      saved.push(s);
    });
    expect(result.inserted).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toBe('boom');
  });

  it('re-importing identical content produces 0 inserts (idempotency)', async () => {
    const first = await planImport('whoop', WHOOP_CSV, async () => new Set());
    const ids = new Set(first.sessions.map((s) => s.id));
    const second = await planImport('whoop', WHOOP_CSV, async () => ids);
    expect(second.willInsert).toBe(0);
    expect(second.collisions).toBe(3);
  });
});
