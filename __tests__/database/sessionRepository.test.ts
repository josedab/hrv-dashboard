jest.mock('../../src/database/database', () => {
  const rows: Record<string, unknown>[] = [];

  const mockDb = {
    runAsync: jest.fn(async (sql: string, ...args: unknown[]) => {
      if (sql.startsWith('INSERT INTO sessions')) {
        const values = args as unknown[];
        rows.push({
          id: values[0],
          timestamp: values[1],
          duration_seconds: values[2],
          rr_intervals: values[3],
          rmssd: values[4],
          sdnn: values[5],
          mean_hr: values[6],
          pnn50: values[7],
          artifact_rate: values[8],
          verdict: values[9],
          perceived_readiness: values[10],
          training_type: values[11],
          notes: values[12],
          sleep_hours: values[13],
          sleep_quality: values[14],
          stress_level: values[15],
          source: values[16],
        });
      }
      if (sql.startsWith('DELETE FROM sessions')) {
        const id = args[0];
        const idx = rows.findIndex((r) => r.id === id);
        if (idx >= 0) rows.splice(idx, 1);
      }
      if (sql.startsWith('UPDATE sessions')) {
        const sessionId = args[args.length - 1];
        const row = rows.find((r) => r.id === sessionId);
        if (row) {
          // Parse SET clause assignments from args
          const setMatch = sql.match(/SET (.+) WHERE/);
          if (setMatch) {
            const assigns = setMatch[1].split(',').map((a) => a.trim());
            assigns.forEach((a, i) => {
              const col = a.split('=')[0].trim();
              row[col] = args[i];
            });
          }
        }
      }
    }),
    getFirstAsync: jest.fn(async (sql: string, ...args: unknown[]) => {
      if (sql.includes('COUNT(*)')) {
        return { count: rows.length };
      }
      if (sql.includes('WHERE id = ?')) {
        return rows.find((r) => r.id === args[0]) ?? null;
      }
      if (sql.includes('WHERE date(timestamp')) {
        const dateStr = args[0] as string;
        return rows.find((r) => (r.timestamp as string).startsWith(dateStr)) ?? null;
      }
      return rows[0] ?? null;
    }),
    getAllAsync: jest.fn(async (sql: string, ..._args: unknown[]) => {
      if (sql.includes('ORDER BY timestamp DESC')) {
        return [...rows].sort(
          (a, b) =>
            new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime()
        );
      }
      return [...rows];
    }),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  };

  return {
    getDatabase: jest.fn(async () => mockDb),
    _mockRows: rows,
    _mockDb: mockDb,
  };
});

import {
  saveSession,
  deleteSession,
  getSessionCount,
  getSessionById,
  upsertManySessionsIfMissing,
} from '../../src/database/sessionRepository';
import { Session } from '../../src/types';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    timestamp: '2026-04-15T06:30:00Z',
    durationSeconds: 300,
    rrIntervals: [800, 810, 790],
    rmssd: 42.5,
    sdnn: 22.1,
    meanHr: 62,
    pnn50: 18.5,
    artifactRate: 0.02,
    verdict: 'go_hard',
    perceivedReadiness: 4,
    trainingType: 'Strength',
    notes: 'felt good',
    sleepHours: 7.5,
    sleepQuality: 4,
    stressLevel: 2,
    source: 'chest_strap',
    ...overrides,
  };
}

const dbModule = require('../../src/database/database') as {
  _mockRows: Record<string, unknown>[];
};

beforeEach(() => {
  dbModule._mockRows.length = 0;
});

describe('saveSession', () => {
  it('inserts a session into the database', async () => {
    const session = makeSession();
    await saveSession(session);
    expect(dbModule._mockRows.length).toBe(1);
    expect(dbModule._mockRows[0].id).toBe('sess-1');
    expect(dbModule._mockRows[0].rmssd).toBe(42.5);
  });

  it('serializes rrIntervals as JSON', async () => {
    const session = makeSession({ rrIntervals: [100, 200, 300] });
    await saveSession(session);
    expect(dbModule._mockRows[0].rr_intervals).toBe('[100,200,300]');
  });
});

describe('deleteSession', () => {
  it('removes a session by id', async () => {
    await saveSession(makeSession({ id: 'del-1' }));
    await saveSession(makeSession({ id: 'del-2' }));
    expect(dbModule._mockRows.length).toBe(2);

    await deleteSession('del-1');
    expect(dbModule._mockRows.length).toBe(1);
    expect(dbModule._mockRows[0].id).toBe('del-2');
  });

  it('is idempotent when id does not exist', async () => {
    await saveSession(makeSession({ id: 'keep' }));
    await deleteSession('nonexistent');
    expect(dbModule._mockRows.length).toBe(1);
  });
});

describe('getSessionCount', () => {
  it('returns 0 for empty database', async () => {
    const count = await getSessionCount();
    expect(count).toBe(0);
  });

  it('returns correct count after inserts', async () => {
    await saveSession(makeSession({ id: 'a' }));
    await saveSession(makeSession({ id: 'b' }));
    const count = await getSessionCount();
    expect(count).toBe(2);
  });
});

describe('getSessionById', () => {
  it('returns session when found', async () => {
    await saveSession(makeSession({ id: 'find-me' }));
    const session = await getSessionById('find-me');
    expect(session).not.toBeNull();
    expect(session!.id).toBe('find-me');
    expect(session!.rmssd).toBe(42.5);
    expect(session!.source).toBe('chest_strap');
  });

  it('returns null when not found', async () => {
    const session = await getSessionById('nonexistent');
    expect(session).toBeNull();
  });

  it('parses rr_intervals from JSON back to array', async () => {
    await saveSession(makeSession({ id: 'parse-test', rrIntervals: [750, 820] }));
    const session = await getSessionById('parse-test');
    expect(session!.rrIntervals).toEqual([750, 820]);
  });
});

describe('upsertManySessionsIfMissing', () => {
  it('inserts new sessions', async () => {
    const sessions = [makeSession({ id: 'bulk-1' }), makeSession({ id: 'bulk-2' })];
    const inserted = await upsertManySessionsIfMissing(sessions);
    expect(inserted).toBe(2);
    expect(dbModule._mockRows.length).toBe(2);
  });

  it('skips sessions with existing ids', async () => {
    await saveSession(makeSession({ id: 'existing' }));
    const sessions = [makeSession({ id: 'existing' }), makeSession({ id: 'new' })];
    const inserted = await upsertManySessionsIfMissing(sessions);
    expect(inserted).toBe(1);
    expect(dbModule._mockRows.length).toBe(2);
  });

  it('returns 0 for empty array', async () => {
    const inserted = await upsertManySessionsIfMissing([]);
    expect(inserted).toBe(0);
  });

  it('skips sessions with missing id', async () => {
    const sessions = [makeSession({ id: '' })];
    const inserted = await upsertManySessionsIfMissing(sessions);
    expect(inserted).toBe(0);
  });
});
