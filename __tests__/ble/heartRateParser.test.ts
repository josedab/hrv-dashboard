import {
  parseHeartRateMeasurement,
  base64ToUint8Array,
  isValidRrInterval,
} from '../../src/ble/heartRateParser';

describe('parseHeartRateMeasurement', () => {
  describe('8-bit HR format', () => {
    it('parses 8-bit HR with no extra fields', () => {
      // Flags: 0x00 (8-bit HR, no RR, no energy)
      // HR: 72
      const data = new Uint8Array([0x00, 72]);
      const result = parseHeartRateMeasurement(data);

      expect(result.heartRate).toBe(72);
      expect(result.rrIntervals).toEqual([]);
      expect(result.energyExpended).toBeUndefined();
      expect(result.sensorContact).toBe(true); // default when not supported
    });

    it('parses 8-bit HR with RR intervals', () => {
      // Flags: 0x10 (8-bit HR, RR present)
      // HR: 65
      // RR: 820ms in 1/1024 sec = 820 * 1024 / 1000 = 839.68 → raw = 840 (approx)
      const rrRaw = Math.round((820 / 1000) * 1024); // 840
      const data = new Uint8Array([
        0x10, // flags: RR present
        65, // HR
        rrRaw & 0xff,
        (rrRaw >> 8) & 0xff, // RR interval (little-endian)
      ]);
      const result = parseHeartRateMeasurement(data);

      expect(result.heartRate).toBe(65);
      expect(result.rrIntervals).toHaveLength(1);
      // Conversion: rrRaw / 1024 * 1000, rounded to 2 decimal places
      const expectedMs = Math.round((rrRaw / 1024) * 1000 * 100) / 100;
      expect(result.rrIntervals[0]).toBeCloseTo(expectedMs, 2);
    });
  });

  describe('16-bit HR format', () => {
    it('parses 16-bit HR value', () => {
      // Flags: 0x01 (16-bit HR)
      // HR: 300 (0x012C) → little-endian: [0x2C, 0x01]
      const data = new Uint8Array([0x01, 0x2c, 0x01]);
      const result = parseHeartRateMeasurement(data);
      expect(result.heartRate).toBe(300);
    });

    it('parses 16-bit HR with RR intervals', () => {
      // Flags: 0x11 (16-bit HR + RR present)
      // HR: 150 (0x0096)
      // RR: ~800ms → raw = 819 (800/1000*1024)
      const rrRaw = Math.round((800 / 1000) * 1024); // 819
      const data = new Uint8Array([
        0x11, // flags: 16-bit HR + RR present
        0x96,
        0x00, // HR = 150
        rrRaw & 0xff,
        (rrRaw >> 8) & 0xff,
      ]);
      const result = parseHeartRateMeasurement(data);

      expect(result.heartRate).toBe(150);
      expect(result.rrIntervals).toHaveLength(1);
    });
  });

  describe('RR intervals', () => {
    it('parses no RR intervals when flag is not set', () => {
      const data = new Uint8Array([0x00, 72]);
      const result = parseHeartRateMeasurement(data);
      expect(result.rrIntervals).toEqual([]);
    });

    it('parses multiple RR intervals in one notification', () => {
      // Two RR intervals
      const rr1Raw = Math.round((800 / 1000) * 1024); // ~819
      const rr2Raw = Math.round((750 / 1000) * 1024); // ~768
      const data = new Uint8Array([
        0x10, // flags: RR present
        70, // HR
        rr1Raw & 0xff,
        (rr1Raw >> 8) & 0xff,
        rr2Raw & 0xff,
        (rr2Raw >> 8) & 0xff,
      ]);
      const result = parseHeartRateMeasurement(data);

      expect(result.rrIntervals).toHaveLength(2);
      const expected1 = Math.round((rr1Raw / 1024) * 1000 * 100) / 100;
      const expected2 = Math.round((rr2Raw / 1024) * 1000 * 100) / 100;
      expect(result.rrIntervals[0]).toBeCloseTo(expected1, 2);
      expect(result.rrIntervals[1]).toBeCloseTo(expected2, 2);
    });

    it('converts RR from 1/1024 sec to milliseconds', () => {
      // Raw value 1024 should be exactly 1000ms
      const data = new Uint8Array([
        0x10, // flags: RR present
        60, // HR
        0x00,
        0x04, // 1024 in little-endian
      ]);
      const result = parseHeartRateMeasurement(data);
      expect(result.rrIntervals[0]).toBe(1000);
    });
  });

  describe('energy expended', () => {
    it('parses energy expended field when present', () => {
      // Flags: 0x08 (energy expended present, 8-bit HR)
      // HR: 80, Energy: 500 (0x01F4) → little-endian [0xF4, 0x01]
      const data = new Uint8Array([0x08, 80, 0xf4, 0x01]);
      const result = parseHeartRateMeasurement(data);

      expect(result.heartRate).toBe(80);
      expect(result.energyExpended).toBe(500);
    });

    it('parses energy expended + RR intervals', () => {
      // Flags: 0x18 (energy present + RR present)
      const rrRaw = Math.round((850 / 1000) * 1024);
      const data = new Uint8Array([
        0x18, // flags: energy + RR
        75, // HR
        0x64,
        0x00, // energy = 100
        rrRaw & 0xff,
        (rrRaw >> 8) & 0xff,
      ]);
      const result = parseHeartRateMeasurement(data);

      expect(result.heartRate).toBe(75);
      expect(result.energyExpended).toBe(100);
      expect(result.rrIntervals).toHaveLength(1);
    });
  });

  describe('sensor contact', () => {
    it('returns true when sensor contact not supported (default)', () => {
      // Flags bits 1-2 both 0: sensor contact not supported
      const data = new Uint8Array([0x00, 72]);
      const result = parseHeartRateMeasurement(data);
      expect(result.sensorContact).toBe(true);
    });

    it('returns false when supported but not detected', () => {
      // Bit 1 set (supported), bit 2 not set (not detected)
      const data = new Uint8Array([0x02, 72]);
      const result = parseHeartRateMeasurement(data);
      expect(result.sensorContact).toBe(false);
    });

    it('returns true when supported and detected', () => {
      // Bits 1 and 2 set (supported and detected)
      const data = new Uint8Array([0x06, 72]);
      const result = parseHeartRateMeasurement(data);
      expect(result.sensorContact).toBe(true);
    });
  });

  describe('error handling', () => {
    it('throws on too-short data (0 bytes)', () => {
      expect(() => parseHeartRateMeasurement(new Uint8Array([]))).toThrow(
        'Heart rate measurement data too short'
      );
    });

    it('throws on too-short data (1 byte)', () => {
      expect(() => parseHeartRateMeasurement(new Uint8Array([0x00]))).toThrow(
        'Heart rate measurement data too short'
      );
    });
  });
});

describe('base64ToUint8Array', () => {
  it('decodes a simple base64 string', () => {
    // "AA==" is base64 for [0x00]
    const result = base64ToUint8Array('AA==');
    expect(result).toEqual(new Uint8Array([0]));
  });

  it('decodes a multi-byte base64 string', () => {
    // Base64 for [0x10, 0x48] = "EEg="
    const bytes = new Uint8Array([0x10, 0x48]);
    const base64 = btoa(String.fromCharCode(...bytes));
    const result = base64ToUint8Array(base64);
    expect(result).toEqual(bytes);
  });

  it('round-trips correctly', () => {
    const original = new Uint8Array([0x10, 65, 0x34, 0x03]);
    const base64 = btoa(String.fromCharCode(...original));
    const decoded = base64ToUint8Array(base64);
    expect(decoded).toEqual(original);
  });

  it('handles empty base64 string', () => {
    const result = base64ToUint8Array('');
    expect(result).toEqual(new Uint8Array([]));
  });
});

describe('isValidRrInterval', () => {
  it('accepts normal resting HR intervals (600-1200ms)', () => {
    expect(isValidRrInterval(800)).toBe(true);
    expect(isValidRrInterval(1000)).toBe(true);
    expect(isValidRrInterval(600)).toBe(true);
  });

  it('accepts boundary values', () => {
    expect(isValidRrInterval(300)).toBe(true);
    expect(isValidRrInterval(2500)).toBe(true);
  });

  it('rejects values below minimum (too fast HR)', () => {
    expect(isValidRrInterval(299)).toBe(false);
    expect(isValidRrInterval(100)).toBe(false);
    expect(isValidRrInterval(0)).toBe(false);
  });

  it('rejects values above maximum (too slow HR)', () => {
    expect(isValidRrInterval(2501)).toBe(false);
    expect(isValidRrInterval(5000)).toBe(false);
  });

  it('rejects negative values', () => {
    expect(isValidRrInterval(-100)).toBe(false);
  });
});

describe('parseHeartRateMeasurement RR validation', () => {
  it('filters out physiologically implausible RR intervals', () => {
    // Encode an RR interval of ~100ms (way too fast, ~600 bpm)
    const rrTooFast = Math.round((100 / 1000) * 1024); // ~102
    // Encode a valid RR interval of ~800ms
    const rrValid = Math.round((800 / 1000) * 1024); // ~820
    const data = new Uint8Array([
      0x10, // flags: RR present, 8-bit HR
      70, // HR
      rrTooFast & 0xff,
      (rrTooFast >> 8) & 0xff,
      rrValid & 0xff,
      (rrValid >> 8) & 0xff,
    ]);
    const result = parseHeartRateMeasurement(data);
    // Only the valid RR should remain
    expect(result.rrIntervals.length).toBe(1);
    expect(result.rrIntervals[0]).toBeGreaterThanOrEqual(300);
  });
});
