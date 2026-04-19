import {
  resolveProfile,
  getProfileById,
  isBaselineEligible,
  listVerifiedDevices,
} from '../../src/ble/deviceProfiles';

describe('resolveProfile', () => {
  it('matches Polar H10 by name prefix', () => {
    const p = resolveProfile('Polar H10 12345');
    expect(p.id).toBe('polar-h10');
    expect(p.sensor).toBe('chest_strap');
    expect(p.includeInBaseline).toBe(true);
  });

  it('matches Polar Verity Sense by substring', () => {
    const p = resolveProfile('Polar Verity Sense ABCD');
    expect(p.id).toBe('polar-verity-sense');
    expect(p.includeInBaseline).toBe(false);
  });

  it('matches Wahoo TICKR by prefix', () => {
    expect(resolveProfile('TICKR X 12').id).toBe('wahoo-tickr');
  });

  it('matches Garmin HRM-Pro variants', () => {
    expect(resolveProfile('HRM-Pro 67890').id).toBe('garmin-hrm-pro');
    expect(resolveProfile('HRM Pro Plus').id).toBe('garmin-hrm-pro');
  });

  it('matches case-insensitively', () => {
    expect(resolveProfile('polar h10 abc').id).toBe('polar-h10');
    expect(resolveProfile('coospo XYZ').id).toBe('coospo');
  });

  it('falls back to generic profile on unknown name', () => {
    expect(resolveProfile('My Custom Sensor').id).toBe('unknown-hrm');
    expect(resolveProfile(null).id).toBe('unknown-hrm');
    expect(resolveProfile(undefined).id).toBe('unknown-hrm');
  });

  it('Apple Watch is not baseline-eligible', () => {
    const p = resolveProfile('Apple Watch SE');
    expect(p.id).toBe('apple-watch');
    expect(isBaselineEligible(p)).toBe(false);
  });
});

describe('getProfileById', () => {
  it('returns null for unknown ids', () => {
    expect(getProfileById('does-not-exist')).toBeNull();
  });

  it('returns the canonical Polar H10 profile', () => {
    expect(getProfileById('polar-h10')?.brand).toBe('Polar');
  });
});

describe('listVerifiedDevices', () => {
  it('excludes the generic unknown profile', () => {
    const list = listVerifiedDevices();
    expect(list.find((p) => p.id === 'unknown-hrm')).toBeUndefined();
    expect(list.length).toBeGreaterThan(0);
  });
});
