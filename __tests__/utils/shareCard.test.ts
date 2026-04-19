import { renderShareCardHtml, renderShareText, ShareCardData } from '../../src/utils/shareCard';

function makeData(overrides: Partial<ShareCardData> = {}): ShareCardData {
  return {
    verdict: 'go_hard',
    rmssdPercent: 105,
    trendDirection: 'improving',
    trendPercent: 8,
    streak: 7,
    date: '2026-04-15',
    ...overrides,
  };
}

describe('renderShareCardHtml', () => {
  it('returns valid HTML with DOCTYPE', () => {
    const html = renderShareCardHtml(makeData());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('contains verdict emoji and label', () => {
    const html = renderShareCardHtml(makeData({ verdict: 'go_hard' }));
    expect(html).toContain('🟢');
    expect(html).toContain('Go Hard');
  });

  it('contains trend information', () => {
    const html = renderShareCardHtml(makeData({ trendDirection: 'improving', trendPercent: 12 }));
    expect(html).toContain('📈');
    expect(html).toContain('+12%');
  });

  it('contains streak count', () => {
    const html = renderShareCardHtml(makeData({ streak: 14 }));
    expect(html).toContain('🔥 14');
  });

  it('contains baseline percentage', () => {
    const html = renderShareCardHtml(makeData({ rmssdPercent: 97 }));
    expect(html).toContain('97% of baseline');
  });

  it('contains branding footer', () => {
    const html = renderShareCardHtml(makeData());
    expect(html).toContain('HRV Readiness Dashboard');
  });

  it('handles rest verdict', () => {
    const html = renderShareCardHtml(makeData({ verdict: 'rest' }));
    expect(html).toContain('🔴');
    expect(html).toContain('Rest');
  });

  it('handles null verdict', () => {
    const html = renderShareCardHtml(makeData({ verdict: null }));
    expect(html).toContain('Building Baseline');
  });

  it('shows declining trend with minus sign', () => {
    const html = renderShareCardHtml(makeData({ trendDirection: 'declining', trendPercent: -5 }));
    expect(html).toContain('📉');
    expect(html).toContain('-5%');
  });
});

describe('renderShareText', () => {
  it('returns multi-line text message', () => {
    const text = renderShareText(makeData());
    expect(text).toContain('🟢 HRV Readiness');
    expect(text).toContain('Go Hard');
    expect(text).toContain('105% of baseline');
    expect(text).toContain('7-day streak');
  });

  it('omits streak for < 3 days', () => {
    const text = renderShareText(makeData({ streak: 2 }));
    expect(text).not.toContain('streak');
  });

  it('includes streak for ≥ 3 days', () => {
    const text = renderShareText(makeData({ streak: 5 }));
    expect(text).toContain('5-day streak');
  });

  it('contains branding', () => {
    const text = renderShareText(makeData());
    expect(text).toContain('HRV Readiness Dashboard');
  });
});
