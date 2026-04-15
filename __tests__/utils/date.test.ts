import {
  toDateString,
  formatDuration,
  calculateStreak,
  todayString,
  formatDate,
  formatDateTime,
} from '../../src/utils/date';

describe('toDateString', () => {
  it('extracts YYYY-MM-DD from ISO timestamp', () => {
    expect(toDateString('2024-01-15T08:30:00Z')).toBe('2024-01-15');
  });

  it('works with date-only string', () => {
    expect(toDateString('2024-12-31')).toBe('2024-12-31');
  });

  it('handles timestamps with timezone offsets', () => {
    expect(toDateString('2024-06-15T23:59:59+05:00')).toBe('2024-06-15');
  });

  it('handles midnight timestamps', () => {
    expect(toDateString('2024-01-01T00:00:00Z')).toBe('2024-01-01');
  });
});

describe('todayString', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    const result = todayString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches current date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayString()).toBe(expected);
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats seconds < 60', () => {
    expect(formatDuration(30)).toBe('0:30');
  });

  it('formats exact minutes', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(120)).toBe('2:00');
    expect(formatDuration(300)).toBe('5:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('pads seconds with leading zero', () => {
    expect(formatDuration(61)).toBe('1:01');
    expect(formatDuration(69)).toBe('1:09');
  });

  it('handles large durations', () => {
    expect(formatDuration(3600)).toBe('60:00');
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('handles single-digit seconds', () => {
    expect(formatDuration(5)).toBe('0:05');
  });
});

describe('formatDate', () => {
  it('formats ISO timestamp as human-readable date', () => {
    const result = formatDate('2024-01-15T08:30:00Z');
    // Output depends on locale, but should contain month and day
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('formatDateTime', () => {
  it('formats ISO timestamp with time', () => {
    const result = formatDateTime('2024-01-15T08:30:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('calculateStreak', () => {
  function daysAgoStr(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('returns 0 for empty array', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('returns 1 for today only', () => {
    expect(calculateStreak([daysAgoStr(0)])).toBe(1);
  });

  it('returns 1 for yesterday only', () => {
    expect(calculateStreak([daysAgoStr(1)])).toBe(1);
  });

  it('returns 0 when most recent date is > 1 day ago', () => {
    expect(calculateStreak([daysAgoStr(3)])).toBe(0);
  });

  it('counts consecutive days from today', () => {
    const dates = [daysAgoStr(0), daysAgoStr(1), daysAgoStr(2)];
    expect(calculateStreak(dates)).toBe(3);
  });

  it('counts consecutive days from yesterday', () => {
    const dates = [daysAgoStr(1), daysAgoStr(2), daysAgoStr(3)];
    expect(calculateStreak(dates)).toBe(3);
  });

  it('stops at gap in consecutive days', () => {
    // Today, yesterday, then gap, then 3 days ago
    const dates = [daysAgoStr(0), daysAgoStr(1), daysAgoStr(3)];
    expect(calculateStreak(dates)).toBe(2);
  });

  it('handles unordered dates', () => {
    const dates = [daysAgoStr(2), daysAgoStr(0), daysAgoStr(1)];
    expect(calculateStreak(dates)).toBe(3);
  });

  it('handles duplicate dates', () => {
    const dates = [daysAgoStr(0), daysAgoStr(0), daysAgoStr(1)];
    expect(calculateStreak(dates)).toBe(2);
  });

  it('returns 0 for future-only dates far from today', () => {
    // A date 10 days in the future - won't match today or yesterday
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(calculateStreak([futureStr])).toBe(0);
  });

  it('handles long streak', () => {
    const dates = Array.from({ length: 30 }, (_, i) => daysAgoStr(i));
    expect(calculateStreak(dates)).toBe(30);
  });
});
