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
