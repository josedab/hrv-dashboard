import { computeBaseline, computeMedian } from '../../src/hrv/baseline';
import { DailyReading } from '../../src/types';

describe('computeMedian', () => {
  it('returns 0 for empty array', () => {
    expect(computeMedian([])).toBe(0);
  });

  it('returns the value for single element', () => {
    expect(computeMedian([42])).toBe(42);
  });

  it('returns middle value for odd count', () => {
    expect(computeMedian([1, 3, 5])).toBe(3);
  });

  it('returns average of two middle values for even count', () => {
    expect(computeMedian([1, 3, 5, 7])).toBe(4);
  });

  it('handles unsorted input', () => {
    expect(computeMedian([5, 1, 3])).toBe(3);
    expect(computeMedian([7, 1, 5, 3])).toBe(4);
  });

  it('does not mutate the original array', () => {
    const arr = [5, 1, 3];
    computeMedian(arr);
    expect(arr).toEqual([5, 1, 3]);
  });

  it('returns correct median where mean ≠ median', () => {
    // Values: [1, 2, 100] → median = 2, mean = 34.33
    expect(computeMedian([1, 2, 100])).toBe(2);
  });

  it('handles two elements', () => {
    expect(computeMedian([10, 20])).toBe(15);
  });

  it('handles identical values', () => {
    expect(computeMedian([5, 5, 5, 5])).toBe(5);
  });

  it('handles negative values', () => {
    expect(computeMedian([-3, -1, 2])).toBe(-1);
  });
});

describe('computeBaseline', () => {
  function makeReading(daysAgo: number, rmssd: number): DailyReading {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: dateStr, rmssd, verdict: null };
  }

  it('returns median of readings within default 7-day window', () => {
    const readings: DailyReading[] = [
      makeReading(0, 50),
      makeReading(1, 60),
      makeReading(2, 55),
      makeReading(3, 45),
      makeReading(4, 65),
    ];

    const result = computeBaseline(readings);
    // Values: [50, 60, 55, 45, 65] → sorted: [45, 50, 55, 60, 65] → median = 55
    expect(result.median).toBe(55);
    expect(result.dayCount).toBe(5);
    expect(result.values).toHaveLength(5);
  });

  it('excludes readings outside the window', () => {
    const readings: DailyReading[] = [
      makeReading(0, 50),
      makeReading(1, 60),
      makeReading(10, 100), // outside 7-day window
      makeReading(20, 200), // outside 7-day window
    ];

    const result = computeBaseline(readings, 7);
    expect(result.dayCount).toBe(2);
    expect(result.median).toBe(55); // (50+60)/2
    expect(result.values).not.toContain(100);
    expect(result.values).not.toContain(200);
  });

  it('returns 0 median for empty readings', () => {
    const result = computeBaseline([]);
    expect(result.median).toBe(0);
    expect(result.dayCount).toBe(0);
    expect(result.values).toEqual([]);
  });

  it('respects custom window size', () => {
    const readings: DailyReading[] = [
      makeReading(0, 50),
      makeReading(1, 60),
      makeReading(2, 70),
      makeReading(4, 80), // within 5-day window
      makeReading(6, 90), // outside 5-day window
    ];

    const result = computeBaseline(readings, 5);
    // Only readings from days 0-4 should be included
    expect(result.dayCount).toBe(4);
    expect(result.values).not.toContain(90);
  });

  it('uses median (not mean) — data where they differ', () => {
    // Outlier-heavy data: [10, 50, 55, 60, 200]
    // Median = 55, Mean = 75
    const readings: DailyReading[] = [
      makeReading(0, 10),
      makeReading(1, 50),
      makeReading(2, 55),
      makeReading(3, 60),
      makeReading(4, 200),
    ];

    const result = computeBaseline(readings);
    expect(result.median).toBe(55);
    // Mean would be 75, confirming we use median
    const mean = (10 + 50 + 55 + 60 + 200) / 5;
    expect(result.median).not.toBe(mean);
  });

  it('handles single reading within window', () => {
    const readings: DailyReading[] = [makeReading(0, 42)];
    const result = computeBaseline(readings);
    expect(result.median).toBe(42);
    expect(result.dayCount).toBe(1);
  });

  it('returns all readings within window as values', () => {
    const readings: DailyReading[] = [makeReading(0, 50), makeReading(1, 60), makeReading(2, 70)];
    const result = computeBaseline(readings);
    expect(result.values).toEqual(expect.arrayContaining([50, 60, 70]));
    expect(result.values).toHaveLength(3);
  });
});
