/**
 * @experimental NOT YET SHIPPED — no production importer as of this writing.
 * See CLAUDE.md → "Experimental modules" before relying on this in app code.
 * Per-device HRM profiles.
 *
 * Different BLE heart-rate monitors have subtly different quirks:
 *   - Polar Verity Sense (optical armband): higher artifact rate, no body
 *     contact bit, supports HR Service.
 *   - Wahoo TICKR / TICKR X: chest strap, body contact reliable.
 *   - Garmin HRM-Pro: chest strap; advertises HR Service.
 *   - Coospo H6/HW9: chest/armband, often missing body-contact bit.
 *
 * This module classifies a device by name into a canonical profile and
 * exposes per-profile tuning (artifact thresholds, accuracy tier).
 */

export type SensorClass = 'chest_strap' | 'optical_armband' | 'optical_wrist' | 'unknown';
export type AccuracyTier = 'research' | 'consumer' | 'fitness';

/**
 * Per-device capability flags. Used to drive vendor-specific R-R parsing
 * and warn the user when a device doesn't expose what we need.
 */
export interface DeviceCapabilities {
  /** Reports beat-to-beat (R-R) intervals via the HR Measurement char. */
  rrIntervals: boolean;
  /** Reports the body-contact-detected bit reliably. */
  bodyContact: boolean;
  /** Reports battery level via the standard Battery Service. */
  battery: boolean;
  /** Vendor-specific enhanced HRV characteristic (e.g. Garmin HRV Pro). */
  enhancedHrv?: boolean;
}

export interface DeviceProfile {
  /** Stable canonical id for analytics + UI. */
  id: string;
  /** User-facing display name. */
  displayName: string;
  /** Manufacturer. */
  brand: string;
  sensor: SensorClass;
  accuracy: AccuracyTier;
  /** Multiplier on the global ARTIFACT_DEVIATION_FACTOR. >1 = more lenient. */
  artifactToleranceFactor: number;
  /** Whether to include readings from this device in baseline computation. */
  includeInBaseline: boolean;
  /** Hardware/firmware capability flags. */
  capabilities: DeviceCapabilities;
  /** Predicate against the BLE-advertised name. */
  matches(advertisedName: string | null | undefined): boolean;
}

const CAP_CHEST: DeviceCapabilities = {
  rrIntervals: true,
  bodyContact: true,
  battery: true,
};
const CAP_OPTICAL: DeviceCapabilities = {
  rrIntervals: true,
  bodyContact: false,
  battery: true,
};
const CAP_WATCH: DeviceCapabilities = {
  rrIntervals: false,
  bodyContact: false,
  battery: false,
};

const _exact = (name: string) => (n: string | null | undefined) =>
  (n ?? '').trim().toLowerCase() === name.toLowerCase();

const startsWith = (prefix: string) => (n: string | null | undefined) =>
  (n ?? '').trim().toLowerCase().startsWith(prefix.toLowerCase());

const containsAny = (parts: string[]) => (n: string | null | undefined) => {
  const lowered = (n ?? '').trim().toLowerCase();
  return parts.some((p) => lowered.includes(p.toLowerCase()));
};

/**
 * Registry order matters: more specific matchers come first.
 * The unknown profile is ALWAYS last and matches everything.
 */
export const DEVICE_PROFILES: DeviceProfile[] = [
  {
    id: 'polar-h10',
    displayName: 'Polar H10',
    brand: 'Polar',
    sensor: 'chest_strap',
    accuracy: 'research',
    artifactToleranceFactor: 1.0,
    includeInBaseline: true,
    capabilities: CAP_CHEST,
    matches: startsWith('Polar H10'),
  },
  {
    id: 'polar-h9',
    displayName: 'Polar H9',
    brand: 'Polar',
    sensor: 'chest_strap',
    accuracy: 'research',
    artifactToleranceFactor: 1.05,
    includeInBaseline: true,
    capabilities: CAP_CHEST,
    matches: startsWith('Polar H9'),
  },
  {
    id: 'polar-verity-sense',
    displayName: 'Polar Verity Sense',
    brand: 'Polar',
    sensor: 'optical_armband',
    accuracy: 'consumer',
    artifactToleranceFactor: 1.5,
    includeInBaseline: false,
    capabilities: CAP_OPTICAL,
    matches: containsAny(['polar verity', 'verity sense']),
  },
  {
    id: 'wahoo-tickr',
    displayName: 'Wahoo TICKR',
    brand: 'Wahoo',
    sensor: 'chest_strap',
    accuracy: 'research',
    artifactToleranceFactor: 1.1,
    includeInBaseline: true,
    capabilities: CAP_CHEST,
    matches: startsWith('TICKR'),
  },
  {
    id: 'garmin-hrm-pro',
    displayName: 'Garmin HRM-Pro',
    brand: 'Garmin',
    sensor: 'chest_strap',
    accuracy: 'research',
    artifactToleranceFactor: 1.1,
    includeInBaseline: true,
    capabilities: { ...CAP_CHEST, enhancedHrv: true },
    matches: containsAny(['HRM-Pro', 'HRM Pro']),
  },
  {
    id: 'garmin-hrm-dual',
    displayName: 'Garmin HRM-Dual',
    brand: 'Garmin',
    sensor: 'chest_strap',
    accuracy: 'fitness',
    artifactToleranceFactor: 1.2,
    includeInBaseline: true,
    capabilities: CAP_CHEST,
    matches: containsAny(['HRM-Dual', 'HRM Dual']),
  },
  {
    id: 'coros-hrm',
    displayName: 'Coros Heart Rate Monitor',
    brand: 'Coros',
    sensor: 'chest_strap',
    accuracy: 'fitness',
    artifactToleranceFactor: 1.2,
    includeInBaseline: true,
    capabilities: CAP_CHEST,
    matches: containsAny(['coros']),
  },
  {
    id: 'coospo',
    displayName: 'COOSPO Heart Rate Monitor',
    brand: 'COOSPO',
    sensor: 'chest_strap',
    accuracy: 'fitness',
    artifactToleranceFactor: 1.3,
    includeInBaseline: true,
    capabilities: { ...CAP_CHEST, bodyContact: false },
    matches: startsWith('COOSPO'),
  },
  {
    id: 'apple-watch',
    displayName: 'Apple Watch',
    brand: 'Apple',
    sensor: 'optical_wrist',
    accuracy: 'consumer',
    artifactToleranceFactor: 1.6,
    includeInBaseline: false,
    capabilities: CAP_WATCH,
    matches: containsAny(['apple watch']),
  },
  {
    id: 'unknown-hrm',
    displayName: 'Generic HR Monitor',
    brand: 'Unknown',
    sensor: 'unknown',
    accuracy: 'fitness',
    artifactToleranceFactor: 1.2,
    includeInBaseline: true,
    capabilities: { rrIntervals: true, bodyContact: false, battery: false },
    matches: () => true,
  },
];

const PROFILE_BY_ID = new Map(DEVICE_PROFILES.map((p) => [p.id, p]));

/**
 * Resolves a profile by BLE-advertised device name. Always returns a
 * non-null profile (falls back to the generic unknown profile).
 */
export function resolveProfile(advertisedName: string | null | undefined): DeviceProfile {
  for (const profile of DEVICE_PROFILES) {
    if (profile.id === 'unknown-hrm') continue;
    if (profile.matches(advertisedName)) return profile;
  }
  // Always returns the generic profile
  return PROFILE_BY_ID.get('unknown-hrm')!;
}

export function getProfileById(id: string): DeviceProfile | null {
  return PROFILE_BY_ID.get(id) ?? null;
}

/**
 * Returns true if a device's readings should be eligible for the rolling
 * baseline. Optical wrist & armband sensors are excluded because their
 * RR jitter would bias the median.
 */
export function isBaselineEligible(profile: DeviceProfile): boolean {
  return profile.includeInBaseline;
}

/** Curated "verified compatible" listing for the device picker UX. */
export function listVerifiedDevices(): DeviceProfile[] {
  return DEVICE_PROFILES.filter((p) => p.id !== 'unknown-hrm');
}
