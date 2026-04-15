import { VerdictType } from '../types';

export interface VerdictInfo {
  key: VerdictType;
  label: string;
  description: string;
  emoji: string;
}

export const VERDICT_INFO: Record<VerdictType, VerdictInfo> = {
  go_hard: {
    key: 'go_hard',
    label: 'Go Hard',
    description: 'HRV is at or above baseline. Full intensity training is appropriate.',
    emoji: '🟢',
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate',
    description: 'HRV is within normal variance below baseline. Train, but avoid max effort.',
    emoji: '🟡',
  },
  rest: {
    key: 'rest',
    label: 'Rest or Easy',
    description: 'HRV is significantly below baseline. Prioritize recovery.',
    emoji: '🔴',
  },
};
