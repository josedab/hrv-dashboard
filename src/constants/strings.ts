/**
 * Centralized UI strings for i18n readiness.
 * All user-facing text should reference these constants.
 */

export const STRINGS = {
  // App
  appName: 'HRV Readiness',
  appVersion: 'v1.0.0',
  appTagline: 'Uses Polar H10 via Heart Rate Service',

  // Common
  cancel: 'Cancel',
  done: 'Done',
  back: 'Back',
  tryAgain: 'Try Again',
  ok: 'OK',
  save: 'Save',
  skip: 'Skip',
  error: 'Error',
  loading: 'Loading...',
  processing: 'Processing...',

  // Tabs
  tabHome: 'Home',
  tabTrends: 'Trends',
  tabHistory: 'History',
  tabSettings: 'Settings',

  // Home Screen
  noReadingYet: 'No reading yet today',
  startReading: 'Start Reading',
  startOrthostaticTest: '🧍 Orthostatic Test',
  startCameraReading: '📸 Camera Reading (No Strap)',
  shareVerdict: '📤 Share Verdict',
  rmssdLast7Days: 'rMSSD — Last 7 Days',
  recoveryScore: 'Recovery Score',
  weeklyTrainingLoad: '📊 Weekly training load:',
  dayStreak: (n: number) => `🔥 ${n} day streak`,

  // Reading Screen
  connectToSensor: 'Connect to Sensor',
  scanningForDevices: 'Scanning for heart rate monitors...',
  noDevicesFound: 'No devices found',
  noDevicesHint: 'Make sure your heart rate monitor is on and nearby',
  scanAgain: 'Scan Again',
  polarH10: 'Polar H10',
  otherHrMonitors: 'Other HR Monitors',
  cancelScanning: 'Cancel scanning',
  finishEarly: 'Finish Early',
  insufficientData: 'Insufficient Data',
  insufficientDataMessage: 'Not enough RR intervals were recorded. Please try again.',
  connectionConnected: '🟢 Connected',
  connectionConnecting: '🟡 Connecting...',
  connectionReconnecting: '🟠 Reconnecting...',
  connectionError: '🔴 Error',
  connectionDisconnected: '⚪ Disconnected',
  highArtifactWarning: (pct: string) => `⚠️ High artifact rate (${pct}%). Check sensor contact.`,

  // Breathing
  guidedBreathing: 'Guided Breathing',
  breathingSubtitle: 'Calm your nervous system before recording for more consistent HRV data.',
  breatheIn: 'Breathe In',
  hold: 'Hold',
  breatheOut: 'Breathe Out',
  getReady: 'Get Ready',
  beginDuration: (min: number) => `Begin (${min} min)`,
  skipToRecording: 'Skip → Start Recording',
  doneToRecording: 'Done → Start Recording',

  // History
  history: 'History',
  rmssdLast30Days: 'rMSSD — Last 30 Days',
  noSessionsYet: 'No sessions yet',
  noSessionsHint: 'Complete your first reading to see history.',

  // Trends
  trends: 'Trends',
  notEnoughData: 'Not enough data yet',
  notEnoughDataHint: 'Complete at least a week of readings to see trends.',
  hrvIs: (direction: string) => `HRV is ${direction}`,
  vsPreviousWeek: (pct: string) => `${pct}% vs. previous week`,
  thisWeek: 'This Week',
  highlights: 'Highlights',
  verdictBreakdown: 'Verdict Breakdown',
  correlations: 'Correlations',

  // Log Screen
  trainingType: 'Training Type',
  notes: 'Notes',
  sleepOptional: 'Sleep (optional)',
  sleepQuality: 'Sleep Quality',
  stressLevel: 'Stress Level',
  howAreYouFeeling: 'How are you feeling?',
  saveAndFinish: 'Save & Finish',
  skipLogging: 'Skip',

  // Session Detail
  hrvMetrics: 'HRV Metrics',
  subjectiveLog: 'Subjective Log',
  perceivedReadiness: 'Perceived Readiness',
  duration: 'Duration',

  // Settings
  settings: 'Settings',
  baselineWindow: 'Baseline Window',
  baselineWindowDesc: 'Number of days used to compute your rolling baseline.',
  advancedThresholds: 'Advanced Thresholds',
  goHardThreshold: 'Go Hard threshold',
  goHardThresholdDesc: 'rMSSD at or above this % of baseline → Go Hard',
  moderateThreshold: 'Moderate threshold',
  moderateThresholdDesc: 'rMSSD at or above this % of baseline → Moderate',
  resetToDefaults: 'Reset to Defaults',
  notifications: 'Notifications',
  morningReminder: 'Morning Reminder',
  streakProtection: 'Streak Protection',
  streakProtectionDesc: 'Remind at 10 AM if no reading taken',
  pairedDevice: 'Paired Device',
  noDevicePaired: 'No device paired. Connect during your next reading.',
  forgetDevice: 'Forget',
  forgetDeviceConfirm: 'Are you sure?',
  healthIntegration: 'Health Integration',
  data: 'Data',
  exportAsCsv: 'Export as CSV',
  createBackup: '🔒 Create Backup',
  restoreBackup: '📥 Restore Backup',
  privacyPolicy: 'Privacy Policy',
  noData: 'No Data',
  noDataMessage: 'No sessions to export.',

  // Backup
  createBackupTitle: 'Create Backup',
  createBackupPrompt: 'Enter a passphrase to encrypt your backup:',
  restoreBackupTitle: 'Restore Backup',
  restoreBackupPrompt: 'Enter the passphrase used when creating this backup:',
  passphraseError: 'Passphrase must be at least 4 characters.',
  restoreSuccess: (count: number) => `Restored ${count} new sessions.`,

  // Onboarding
  onboardingSlides: [
    {
      emoji: '❤️',
      title: 'Morning Readiness in 5 Minutes',
      description:
        'Put on your heart rate monitor, lie still, and get an objective readiness verdict for the day.',
    },
    {
      emoji: '📊',
      title: 'Science-Backed Metrics',
      description:
        'rMSSD, SDNN, and heart rate computed from your RR intervals. Artifact detection filters out noise.',
    },
    {
      emoji: '🎯',
      title: 'Three Clear Verdicts',
      description:
        'Go Hard, Moderate, or Rest. Based on your personal 7-day baseline — no guesswork.',
    },
    {
      emoji: '🔒',
      title: 'Your Data, Your Device',
      description:
        'Everything stays on your phone. No cloud, no accounts, no tracking. Export anytime via CSV.',
    },
  ],

  // Orthostatic
  orthostaticTest: 'Orthostatic Test',
  orthostaticSubtitle:
    'A 5-minute test measuring your HRV response to standing up. More sensitive to overtraining than supine-only measurement.',
  orthostaticPhase1: '1️⃣ Lie down — 2.5 min supine recording',
  orthostaticPhase2: '2️⃣ Stand up — 10 second transition',
  orthostaticPhase3: '3️⃣ Stand still — 2.5 min standing recording',
  orthostaticHint:
    'This test requires a connected HR monitor. Start a normal reading first to connect your device, then come back here.',
  orthostaticResults: 'Orthostatic Results',
  reactivity: 'Reactivity',
  supine: 'Supine',
  standing: 'Standing',
  lieStill: '🛌 Lie Still',
  standUpNow: '🏃 Stand Up Now!',
  standStill: '🧍 Stand Still',

  // Camera
  cameraReading: 'Camera HRV Reading',
  cameraSubtitle:
    "Measure your heart rate variability using your phone's camera. Place your fingertip over the rear camera lens.",
  cameraInstruction1: '1. The camera flash will turn on as a light source',
  cameraInstruction2: '2. Cover the camera + flash with your fingertip',
  cameraInstruction3: "3. Hold steady for 60 seconds — don't press too hard",
  cameraInstruction4: '4. Your screen should appear reddish if positioned correctly',
  cameraAccuracy:
    "⚠️ Camera PPG is less accurate than a chest strap. Best for days when your HR monitor isn't available.",
  startCameraRecording: 'Start Camera Recording',
  useChestStrap: '← Use Chest Strap Instead',
  keepFingertipOnCamera: 'Keep fingertip on camera',
  lowSignalQuality: 'Low Signal Quality',

  // Verdict
  buildingBaseline: 'Building Baseline',
  buildingBaselineDesc: 'Need more days of readings to compute verdict.',
  rmssdLabel: (value: string) => `rMSSD: ${value} ms`,
  baselinePercent: (pct: number, baseline: string) => `${pct}% of baseline (${baseline} ms)`,

  // Metrics
  meanHr: 'Mean HR',
  sdnn: 'SDNN',
  artifacts: 'Artifacts',
  pnn50: 'pNN50',
  heartRate: 'Heart Rate',
  rrCount: 'RR Count',

  // Units
  ms: 'ms',
  bpm: 'bpm',
  percent: '%',

  // Error Boundary
  somethingWentWrong: 'Something went wrong',
  errorBoundaryEmoji: '😵',

  // Privacy
  privacyTitle: 'Privacy Policy',
  privacyLastUpdated: 'Last updated: April 2026',
} as const;
