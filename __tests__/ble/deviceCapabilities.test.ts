import { resolveProfile, listVerifiedDevices } from '../../src/experimental/ble/deviceProfiles';

describe('device capabilities', () => {
  it('every profile declares capability flags', () => {
    for (const p of listVerifiedDevices()) {
      expect(p.capabilities).toBeDefined();
      expect(typeof p.capabilities.rrIntervals).toBe('boolean');
      expect(typeof p.capabilities.bodyContact).toBe('boolean');
      expect(typeof p.capabilities.battery).toBe('boolean');
    }
  });

  it('Garmin HRM-Pro advertises enhancedHrv', () => {
    expect(resolveProfile('HRM-Pro Plus').capabilities.enhancedHrv).toBe(true);
  });

  it('Polar Verity Sense exposes RR but not body contact', () => {
    const p = resolveProfile('Polar Verity Sense XYZ');
    expect(p.capabilities.rrIntervals).toBe(true);
    expect(p.capabilities.bodyContact).toBe(false);
  });

  it('Apple Watch profile reports no RR via standard HR Service', () => {
    expect(resolveProfile('Apple Watch SE').capabilities.rrIntervals).toBe(false);
  });

  it('matches Polar H9 and Coros straps', () => {
    expect(resolveProfile('Polar H9 9999').id).toBe('polar-h9');
    expect(resolveProfile('Coros Heart Rate ABC').id).toBe('coros-hrm');
  });
});
