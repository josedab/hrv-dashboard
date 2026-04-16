import { computeVerdict } from '../../src/hrv/verdict';
import { BaselineResult, Settings, DEFAULT_SETTINGS } from '../../src/types';

function makeBaseline(median: number, dayCount: number): BaselineResult {
  return {
    median,
    dayCount,
    values: Array(dayCount).fill(median),
  };
}

describe('computeVerdict', () => {
  describe('with sufficient baseline (>= 5 days)', () => {
    const baseline = makeBaseline(100, 7);

    it('returns "go_hard" when rMSSD >= 95% of baseline', () => {
      expect(computeVerdict(95, baseline)).toBe('go_hard');
      expect(computeVerdict(100, baseline)).toBe('go_hard');
      expect(computeVerdict(120, baseline)).toBe('go_hard');
    });

    it('returns "moderate" when rMSSD between 80-95% of baseline', () => {
      expect(computeVerdict(80, baseline)).toBe('moderate');
      expect(computeVerdict(90, baseline)).toBe('moderate');
      expect(computeVerdict(94.9, baseline)).toBe('moderate');
    });

    it('returns "rest" when rMSSD < 80% of baseline', () => {
      expect(computeVerdict(79.9, baseline)).toBe('rest');
      expect(computeVerdict(50, baseline)).toBe('rest');
      expect(computeVerdict(0, baseline)).toBe('rest');
    });

    it('handles exact boundary at go_hard threshold (0.95)', () => {
      // ratio = 95/100 = 0.95 → exactly at threshold → go_hard (>=)
      expect(computeVerdict(95, baseline)).toBe('go_hard');
    });

    it('handles exact boundary at moderate threshold (0.80)', () => {
      // ratio = 80/100 = 0.80 → exactly at threshold → moderate (>=)
      expect(computeVerdict(80, baseline)).toBe('moderate');
    });

    it('just below go_hard threshold returns moderate', () => {
      // ratio = 94.99/100 = 0.9499 < 0.95
      expect(computeVerdict(94.99, baseline)).toBe('moderate');
    });

    it('just below moderate threshold returns rest', () => {
      // ratio = 79.99/100 = 0.7999 < 0.80
      expect(computeVerdict(79.99, baseline)).toBe('rest');
    });
  });

  describe('insufficient baseline', () => {
    it('returns null when baseline has < 5 days', () => {
      const baseline = makeBaseline(100, 4);
      expect(computeVerdict(95, baseline)).toBeNull();
    });

    it('returns null when baseline has 0 days', () => {
      const baseline = makeBaseline(0, 0);
      expect(computeVerdict(95, baseline)).toBeNull();
    });

    it('returns null when baseline has exactly 4 days', () => {
      const baseline = makeBaseline(100, 4);
      expect(computeVerdict(100, baseline)).toBeNull();
    });

    it('returns verdict when baseline has exactly 5 days', () => {
      const baseline = makeBaseline(100, 5);
      expect(computeVerdict(100, baseline)).toBe('go_hard');
    });
  });

  describe('baseline median is 0', () => {
    it('returns null when median is 0', () => {
      const baseline = makeBaseline(0, 7);
      expect(computeVerdict(95, baseline)).toBeNull();
    });

    it('returns null even with high rMSSD when median is 0', () => {
      const baseline = makeBaseline(0, 10);
      expect(computeVerdict(200, baseline)).toBeNull();
    });
  });

  describe('custom threshold settings', () => {
    const baseline = makeBaseline(100, 7);

    it('uses custom goHardThreshold', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        goHardThreshold: 0.9,
        moderateThreshold: 0.7,
      };

      // 90/100 = 0.90 → exactly at custom go_hard threshold
      expect(computeVerdict(90, baseline, settings)).toBe('go_hard');
      // 89.9/100 = 0.899 → below go_hard, above moderate
      expect(computeVerdict(89.9, baseline, settings)).toBe('moderate');
    });

    it('uses custom moderateThreshold', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        goHardThreshold: 0.95,
        moderateThreshold: 0.6,
      };

      // 60/100 = 0.60 → at moderate threshold
      expect(computeVerdict(60, baseline, settings)).toBe('moderate');
      // 59.9/100 = 0.599 → below moderate → rest
      expect(computeVerdict(59.9, baseline, settings)).toBe('rest');
    });

    it('works with very lenient thresholds', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        goHardThreshold: 0.5,
        moderateThreshold: 0.3,
      };

      expect(computeVerdict(50, baseline, settings)).toBe('go_hard');
      expect(computeVerdict(30, baseline, settings)).toBe('moderate');
      expect(computeVerdict(29, baseline, settings)).toBe('rest');
    });
  });

  describe('edge cases', () => {
    it('handles very high rMSSD relative to baseline', () => {
      const baseline = makeBaseline(50, 7);
      expect(computeVerdict(500, baseline)).toBe('go_hard');
    });

    it('handles rMSSD of 0', () => {
      const baseline = makeBaseline(100, 7);
      expect(computeVerdict(0, baseline)).toBe('rest');
    });

    it('uses default settings when none provided', () => {
      const baseline = makeBaseline(100, 7);
      // Default thresholds: goHard = 0.95, moderate = 0.80
      expect(computeVerdict(95, baseline)).toBe('go_hard');
      expect(computeVerdict(80, baseline)).toBe('moderate');
      expect(computeVerdict(79, baseline)).toBe('rest');
    });
  });
});
