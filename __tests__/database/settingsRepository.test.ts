jest.mock('../../src/database/database', () => ({
  getDatabase: jest.fn(),
}));

import { validateThresholds } from '../../src/database/settingsRepository';

describe('validateThresholds', () => {
  it('accepts valid threshold combination', () => {
    expect(validateThresholds(0.95, 0.8)).toBeNull();
  });

  it('accepts edge case with wide gap', () => {
    expect(validateThresholds(1.0, 0.5)).toBeNull();
  });

  it('accepts minimum valid gap', () => {
    expect(validateThresholds(0.9, 0.85)).toBeNull();
  });

  it('rejects moderate equal to goHard', () => {
    const result = validateThresholds(0.95, 0.95);
    expect(result).not.toBeNull();
    expect(result).toContain('lower');
  });

  it('rejects moderate greater than goHard', () => {
    const result = validateThresholds(0.8, 0.9);
    expect(result).not.toBeNull();
  });

  it('rejects goHard threshold of zero', () => {
    const result = validateThresholds(0, 0.8);
    expect(result).not.toBeNull();
  });

  it('rejects goHard threshold above 1', () => {
    const result = validateThresholds(1.5, 0.8);
    expect(result).not.toBeNull();
  });

  it('rejects moderate threshold of zero', () => {
    const result = validateThresholds(0.95, 0);
    expect(result).not.toBeNull();
  });

  it('rejects moderate threshold above 1', () => {
    const result = validateThresholds(0.95, 1.5);
    expect(result).not.toBeNull();
  });

  it('rejects negative thresholds', () => {
    expect(validateThresholds(-0.5, 0.8)).not.toBeNull();
    expect(validateThresholds(0.95, -0.1)).not.toBeNull();
  });
});

import { loadSettings } from '../../src/database/settingsRepository';
import { getDatabase } from '../../src/database/database';
import { DEFAULT_SETTINGS } from '../../src/types';

describe('loadSettings', () => {
  function mockRows(rows: Array<{ key: string; value: string }>) {
    (getDatabase as jest.Mock).mockResolvedValue({
      getAllAsync: jest.fn().mockResolvedValue(rows),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to defaults when no rows exist', async () => {
    mockRows([]);
    const result = await loadSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('parses verdictMode=adaptive from storage', async () => {
    mockRows([{ key: 'verdictMode', value: 'adaptive' }]);
    const result = await loadSettings();
    expect(result.verdictMode).toBe('adaptive');
  });

  it('parses verdictMode=fixed from storage', async () => {
    mockRows([{ key: 'verdictMode', value: 'fixed' }]);
    const result = await loadSettings();
    expect(result.verdictMode).toBe('fixed');
  });

  it('falls back to fixed verdictMode for unknown values', async () => {
    mockRows([{ key: 'verdictMode', value: 'experimental_v3' }]);
    const result = await loadSettings();
    expect(result.verdictMode).toBe('fixed');
  });

  it('falls back to default verdictMode when not stored', async () => {
    mockRows([{ key: 'baselineWindowDays', value: '7' }]);
    const result = await loadSettings();
    expect(result.verdictMode).toBe(DEFAULT_SETTINGS.verdictMode);
  });

  it('out-of-range baselineWindowDays falls back to default', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRows([{ key: 'baselineWindowDays', value: '99' }]);
    const result = await loadSettings();
    expect(result.baselineWindowDays).toBe(DEFAULT_SETTINGS.baselineWindowDays);
    warn.mockRestore();
  });

  it('inconsistent threshold pair resets both to defaults', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRows([
      { key: 'goHardThreshold', value: '0.5' },
      { key: 'moderateThreshold', value: '0.8' },
    ]);
    const result = await loadSettings();
    expect(result.goHardThreshold).toBe(DEFAULT_SETTINGS.goHardThreshold);
    expect(result.moderateThreshold).toBe(DEFAULT_SETTINGS.moderateThreshold);
    warn.mockRestore();
  });
});
