/**
 * Result of parsing a Heart Rate Measurement notification.
 */
export interface HeartRateMeasurement {
  heartRate: number;          // bpm
  rrIntervals: number[];      // ms (can have 0, 1, or more per notification)
  energyExpended?: number;    // kJ
  sensorContact: boolean;
}

/**
 * Parses a Heart Rate Measurement characteristic value (0x2A37)
 * per the Bluetooth GATT specification.
 *
 * Byte layout:
 * - Byte 0: Flags
 *   - Bit 0: HR format (0 = UINT8, 1 = UINT16)
 *   - Bit 1-2: Sensor contact status
 *   - Bit 3: Energy expended present
 *   - Bit 4: RR-interval present
 * - Byte 1(+2): Heart Rate value
 * - Optional: Energy Expended (UINT16)
 * - Optional: RR Intervals (UINT16 each, in 1/1024 sec units)
 */
export function parseHeartRateMeasurement(data: Uint8Array): HeartRateMeasurement {
  if (data.length < 2) {
    throw new Error('Heart rate measurement data too short');
  }

  const flags = data[0];
  const isHrFormat16Bit = (flags & 0x01) !== 0;
  const sensorContactSupported = (flags & 0x02) !== 0;
  const sensorContactDetected = (flags & 0x04) !== 0;
  const energyExpendedPresent = (flags & 0x08) !== 0;
  const rrIntervalPresent = (flags & 0x10) !== 0;

  let offset = 1;

  // Parse heart rate
  let heartRate: number;
  if (isHrFormat16Bit) {
    heartRate = data[offset] | (data[offset + 1] << 8);
    offset += 2;
  } else {
    heartRate = data[offset];
    offset += 1;
  }

  // Parse energy expended (if present)
  let energyExpended: number | undefined;
  if (energyExpendedPresent) {
    energyExpended = data[offset] | (data[offset + 1] << 8);
    offset += 2;
  }

  // Parse RR intervals (if present)
  const rrIntervals: number[] = [];
  if (rrIntervalPresent) {
    while (offset + 1 < data.length) {
      // RR intervals are in 1/1024 second units; convert to milliseconds
      const rrRaw = data[offset] | (data[offset + 1] << 8);
      const rrMs = (rrRaw / 1024) * 1000;
      rrIntervals.push(Math.round(rrMs * 100) / 100); // round to 2 decimal places
      offset += 2;
    }
  }

  const sensorContact = sensorContactSupported ? sensorContactDetected : true;

  return {
    heartRate,
    rrIntervals,
    energyExpended,
    sensorContact,
  };
}

/**
 * Decodes a base64-encoded BLE characteristic value to Uint8Array.
 * react-native-ble-plx provides values as base64.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
