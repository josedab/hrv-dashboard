---
sidebar_position: 9
title: Workout Generation
---

# Workout Generation

The app generates **verdict-based workout prescriptions** and exports them to popular training platforms. When your HRV says "Go Hard," you get an intensity-appropriate workout. When it says "Rest," you get a recovery session.

## How It Works

After your morning reading, the app generates a workout tailored to:
- Your **verdict** (Go Hard / Moderate / Rest)
- Your **sport profile** (cycling, running, strength, BJJ, rest day)
- Your **Training Stress Balance** (ATL/CTL/TSB) if enough history exists

## Sport Profiles

| Profile | Go Hard | Moderate | Rest |
|---------|---------|----------|------|
| **Cycling** | Intervals, threshold work | Tempo, endurance | Recovery spin |
| **Running** | Speed work, tempo runs | Easy-moderate pace | Walk, light jog |
| **Strength** | Heavy compound lifts | Moderate volume | Mobility, stretching |
| **BJJ** | Hard sparring, competition prep | Technical drilling | Light flow rolling |
| **Rest Day** | Active recovery | Gentle movement | Complete rest |

## Workout Structure

Each generated workout includes:

```typescript
interface WorkoutPrescription {
  sport: SportProfile;
  verdict: VerdictType;
  blocks: WorkoutBlock[];      // Warm-up, main set, cool-down
  totalDurationMinutes: number;
  estimatedLoad: number;       // 0–100 RPE-based load
}
```

Blocks are structured with intensity zones and durations for precise execution.

## Exporting Workouts

### Strava
Push workout details as a **planned workout** note:
```typescript
pushToStrava(workout, date, config)
```

### TrainingPeaks
Upload a **ZWO-format XML** file (Zwift-compatible) with FTP-normalized power targets:
```typescript
pushToTrainingPeaks(workout, date, athleteId, config)
toZwoXml(workout, athleteName)  // Generate Zwift workout file
```

### Intervals.icu
Push as a **workout event** via the Intervals.icu API:
```typescript
pushToIntervalsIcu(workout, date, athleteId, config)
```

### Plain Text
Get a human-readable workout description for copying to notes or messaging:
```typescript
renderPlainText(workout)
```

## Training Stress Balance

The app tracks your **fitness and fatigue** using the ATL/CTL/TSB model (based on Banister's impulse-response model):

| Metric | Full Name | Time Constant | What It Represents |
|--------|-----------|---------------|-------------------|
| **ATL** | Acute Training Load | 7 days | Short-term fatigue |
| **CTL** | Chronic Training Load | 42 days | Long-term fitness |
| **TSB** | Training Stress Balance | CTL − ATL | Freshness |

### TSB Zones

| TSB Range | Classification | Training Guidance |
|-----------|---------------|-------------------|
| > +15 | Fresh | Ready to perform; risk of detraining if sustained |
| −10 to +15 | Optimal | Productive training zone |
| −30 to −10 | Fatigued | Accumulating load; recovery needed soon |
| < −30 | Overreaching | High risk of overtraining; reduce volume |

TSB data feeds into workout generation — the app won't prescribe high-intensity work when your TSB indicates overreaching, even if your morning HRV says "Go Hard."
