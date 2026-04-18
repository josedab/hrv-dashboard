import { STRINGS } from '../../src/constants/strings';

describe('STRINGS', () => {
  const entries = Object.entries(STRINGS);

  it('has at least 50 string keys', () => {
    expect(entries.length).toBeGreaterThanOrEqual(50);
  });

  it.each(
    entries
      .filter(([, v]) => typeof v === 'string')
      .map(([key, value]) => [key, value] as [string, string])
  )('%s is a non-empty string', (_key, value) => {
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
  });

  it.each(
    entries
      .filter(([, v]) => typeof v === 'function')
      .map(([key, value]) => [key, value] as [string, (...args: never[]) => string])
  )('%s is a function returning a string', (key, fn) => {
    let result: string;
    switch (key) {
      case 'dayStreak':
        result = (fn as (n: number) => string)(5);
        break;
      case 'highArtifactWarning':
        result = (fn as (pct: string) => string)('12.5');
        break;
      case 'beginDuration':
        result = (fn as (min: number) => string)(2);
        break;
      case 'hrvIs':
        result = (fn as (d: string) => string)('trending up');
        break;
      case 'vsPreviousWeek':
        result = (fn as (pct: string) => string)('8');
        break;
      case 'restoreSuccess':
        result = (fn as (n: number) => string)(10);
        break;
      case 'rmssdLabel':
        result = (fn as (v: string) => string)('42.3');
        break;
      case 'baselinePercent':
        result = (fn as (pct: number, b: string) => string)(95, '45.1');
        break;
      default:
        result = String(fn);
    }
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('onboardingSlides has 4 complete slides', () => {
    expect(STRINGS.onboardingSlides).toHaveLength(4);
    for (const slide of STRINGS.onboardingSlides) {
      expect(slide.emoji.length).toBeGreaterThan(0);
      expect(slide.title.length).toBeGreaterThan(0);
      expect(slide.description.length).toBeGreaterThan(0);
    }
  });

  it('has no excessive duplicate string values', () => {
    const staticStrings = entries
      .filter(([, v]) => typeof v === 'string')
      .map(([, v]) => v as string);
    const dupes = staticStrings.filter((v, i) => staticStrings.indexOf(v) !== i);
    expect(dupes.length).toBeLessThan(staticStrings.length * 0.1);
  });
});
