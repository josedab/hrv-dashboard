import { parseVerdict, parseSessionSource, parseVerdictMode } from '../../src/types';

describe('parseVerdict', () => {
  it('accepts the three valid verdicts', () => {
    expect(parseVerdict('go_hard')).toBe('go_hard');
    expect(parseVerdict('moderate')).toBe('moderate');
    expect(parseVerdict('rest')).toBe('rest');
  });

  it('returns null for unknown strings', () => {
    expect(parseVerdict('unknown')).toBeNull();
    expect(parseVerdict('GO_HARD')).toBeNull();
    expect(parseVerdict('')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(parseVerdict(null)).toBeNull();
    expect(parseVerdict(undefined)).toBeNull();
    expect(parseVerdict(42)).toBeNull();
    expect(parseVerdict({})).toBeNull();
  });
});

describe('parseSessionSource', () => {
  it('accepts the two valid sources', () => {
    expect(parseSessionSource('chest_strap')).toBe('chest_strap');
    expect(parseSessionSource('camera')).toBe('camera');
  });

  it('defaults to chest_strap for unknown values', () => {
    expect(parseSessionSource('strap')).toBe('chest_strap');
    expect(parseSessionSource(null)).toBe('chest_strap');
    expect(parseSessionSource(undefined)).toBe('chest_strap');
    expect(parseSessionSource(99)).toBe('chest_strap');
  });
});

describe('parseVerdictMode', () => {
  it('accepts the two valid modes', () => {
    expect(parseVerdictMode('fixed')).toBe('fixed');
    expect(parseVerdictMode('adaptive')).toBe('adaptive');
  });

  it('defaults to fixed for unknown values', () => {
    expect(parseVerdictMode('experimental')).toBe('fixed');
    expect(parseVerdictMode('')).toBe('fixed');
    expect(parseVerdictMode(null)).toBe('fixed');
    expect(parseVerdictMode(undefined)).toBe('fixed');
    expect(parseVerdictMode(true)).toBe('fixed');
  });
});
