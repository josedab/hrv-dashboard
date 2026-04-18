import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { computeHrvMetrics } from '../hrv/metrics';
import { computeBaseline } from '../hrv/baseline';
import { computeVerdict } from '../hrv/verdict';
import { computeAdaptiveVerdict } from '../hrv/adaptiveThresholds';
import { getDailyReadings, getRecentSessions, saveSession } from '../database/sessionRepository';
import { loadSettings } from '../database/settingsRepository';
import { generateId } from '../utils/uuid';
import { refreshWidget } from '../utils/widgetData';
import type { Session, SessionSource } from '../types';

/** Days of history fed to the adaptive percentile fit (≈ 2 months). */
const ADAPTIVE_HISTORY_DAYS = 60;

/** Inputs required to finalize a recording. */
export interface FinalizeInput {
  rrIntervals: number[];
  durationSeconds: number;
  source: SessionSource;
}

/** Result of {@link UseSessionPersistence.finalize}. */
export type FinalizeResult =
  | { kind: 'saved'; sessionId: string; session: Session }
  | { kind: 'error'; error: Error };

export interface UseSessionPersistence {
  /**
   * Persists a recording end-to-end:
   *   compute metrics → load settings → load baseline → compute verdict
   *   → INSERT session → refresh widget → navigate to LogScreen.
   *
   * On success, navigation is performed before returning. On failure, the
   * caller is responsible for surfacing the error to the user.
   */
  finalize: (input: FinalizeInput) => Promise<FinalizeResult>;
}

/**
 * Pure async workflow extracted from {@link useSessionPersistence} so it
 * can be unit-tested without a React renderer. Performs all I/O via the
 * imported repositories; navigation is invoked through the supplied
 * callback so the caller can stub it in tests.
 */
export async function finalizeSession(
  input: FinalizeInput,
  onSaved: (sessionId: string) => void
): Promise<FinalizeResult> {
  const { rrIntervals, durationSeconds, source } = input;
  try {
    const metrics = computeHrvMetrics(rrIntervals);
    const settings = await loadSettings();
    const dailyReadings = await getDailyReadings(settings.baselineWindowDays);
    const baseline = computeBaseline(dailyReadings, settings.baselineWindowDays);

    let verdict;
    if (settings.verdictMode === 'adaptive') {
      // Chest-strap-only history fed into the percentile fit; camera
      // sessions are intentionally excluded from baseline elsewhere
      // and we mirror that here for consistency.
      const history = (await getRecentSessions(ADAPTIVE_HISTORY_DAYS)).filter(
        (s) => s.source === 'chest_strap'
      );
      const adaptive = computeAdaptiveVerdict(metrics.rmssd, history, baseline, settings);
      verdict = adaptive.verdict;
    } else {
      verdict = computeVerdict(metrics.rmssd, baseline, settings);
    }

    const session: Session = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      durationSeconds,
      rrIntervals,
      rmssd: metrics.rmssd,
      sdnn: metrics.sdnn,
      meanHr: metrics.meanHr,
      pnn50: metrics.pnn50,
      artifactRate: metrics.artifactRate,
      verdict,
      perceivedReadiness: null,
      trainingType: null,
      notes: null,
      sleepHours: null,
      sleepQuality: null,
      stressLevel: null,
      source,
    };

    await saveSession(session);
    refreshWidget().catch(() => {}); // fire-and-forget
    onSaved(session.id);
    return { kind: 'saved', sessionId: session.id, session };
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(`Save failed: ${String(caught)}`);
    console.error('[useSessionPersistence] finalize failed:', error);
    return { kind: 'error', error };
  }
}

/**
 * Centralised "save a recording" workflow used by both the chest-strap
 * ReadingScreen and the camera PPG screen. Eliminates the prior
 * cut-and-paste drift between the two screens.
 */
export function useSessionPersistence(): UseSessionPersistence {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const finalize = useCallback(
    (input: FinalizeInput): Promise<FinalizeResult> =>
      finalizeSession(input, (sessionId) => {
        navigation.replace('Log', { sessionId });
      }),
    [navigation]
  );

  return { finalize };
}
