/**
 * @experimental NOT YET SHIPPED — no production importer as of this writing.
 * See CLAUDE.md → "Experimental modules" before relying on this in app code.
 * Push service that wires the existing exporters
 * (`src/workout/exporters.ts`) to OAuth token storage and a single
 * `pushPlannedWorkout` entry point the Home / post-verdict UI calls.
 *
 * Tokens are persisted in the `settings` table (already SQLite-backed)
 * under per-platform keys. The actual HTTP layer is the exporters; this
 * module only supplies the OAuth state + a fetch wrapper.
 */
import { WorkoutPrescription } from '../../workout/generator';
import { pushToStrava, pushToTrainingPeaks, pushToIntervalsIcu, ExportResult } from './exporters';

export type PushPlatform = 'strava' | 'trainingpeaks' | 'intervals';

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  /** Unix epoch ms when accessToken stops being valid. */
  expiresAt?: number;
  /** Platform-specific user id (Strava athlete id, intervals.icu athlete id, etc.). */
  externalId?: string;
}

export type TokenStore = {
  get(platform: PushPlatform): Promise<OAuthToken | null>;
  set(platform: PushPlatform, token: OAuthToken): Promise<void>;
  clear(platform: PushPlatform): Promise<void>;
};

export interface PushOptions {
  date: string;
  fetchImpl?: typeof fetch;
}

export class PushService {
  constructor(private readonly tokens: TokenStore) {}

  async isConnected(platform: PushPlatform): Promise<boolean> {
    const t = await this.tokens.get(platform);
    if (!t) return false;
    if (t.expiresAt !== undefined && t.expiresAt < Date.now()) return false;
    return true;
  }

  async disconnect(platform: PushPlatform): Promise<void> {
    await this.tokens.clear(platform);
  }

  /** Pushes the workout. Returns the unified `ExportResult` from the exporter. */
  async pushPlannedWorkout(
    platform: PushPlatform,
    workout: WorkoutPrescription,
    opts: PushOptions
  ): Promise<ExportResult> {
    const token = await this.tokens.get(platform);
    if (!token) {
      return { ok: false, error: `${platform} not connected` };
    }
    if (token.expiresAt !== undefined && token.expiresAt < Date.now()) {
      return { ok: false, error: `${platform} token expired — please reconnect` };
    }

    const fetchImpl = opts.fetchImpl ?? fetch;

    switch (platform) {
      case 'strava':
        return pushToStrava(workout, opts.date, { accessToken: token.accessToken, fetchImpl });
      case 'trainingpeaks':
        if (!token.externalId) return { ok: false, error: 'Missing TrainingPeaks athlete id' };
        return pushToTrainingPeaks(workout, opts.date, token.externalId, {
          accessToken: token.accessToken,
          fetchImpl,
        });
      case 'intervals':
        if (!token.externalId) return { ok: false, error: 'Missing Intervals.icu athlete id' };
        return pushToIntervalsIcu(workout, opts.date, token.externalId, {
          accessToken: token.accessToken,
          fetchImpl,
        });
    }
  }
}

/** In-memory token store; useful for tests and as a fallback. */
export class InMemoryTokenStore implements TokenStore {
  private readonly map = new Map<PushPlatform, OAuthToken>();
  async get(platform: PushPlatform) {
    return this.map.get(platform) ?? null;
  }
  async set(platform: PushPlatform, token: OAuthToken) {
    this.map.set(platform, token);
  }
  async clear(platform: PushPlatform) {
    this.map.delete(platform);
  }
}
