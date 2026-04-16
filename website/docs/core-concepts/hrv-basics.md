---
sidebar_position: 1
---

# HRV Basics

## What is Heart Rate Variability?

Heart Rate Variability (HRV) is the variation in time between successive heartbeats, measured in milliseconds. While your average heart rate might be 60 beats per minute, the actual intervals between beats are rarely exactly one second—they naturally fluctuate by tens or hundreds of milliseconds. This fluctuation is HRV, and it's a powerful marker of your nervous system's state and your readiness to perform.

A healthy heart isn't metronome-like; it adapts to your environment and demands. Higher HRV typically indicates better fitness, faster recovery, and greater parasympathetic (rest-and-digest) tone. Lower HRV may signal stress, fatigue, illness, or inadequate recovery. For athletes and health-conscious individuals, HRV serves as a morning readiness metric: if your HRV drops significantly from your personal baseline, your body may be telling you to prioritize recovery that day.

This app measures your HRV each morning using the Polar H10 chest strap via Bluetooth Low Energy (BLE). In just 5 minutes, it captures hundreds of heartbeats, computes scientifically validated metrics, and gives you an actionable verdict: Go Hard, Moderate, or Rest.

## Why RR Intervals Matter (Not Just Heart Rate)

Your average heart rate alone doesn't tell the full story. Two people with a heart rate of 60 bpm can have vastly different HRV. One might have perfectly regular intervals (60 bpm, no variation = low HRV), while the other has natural beat-to-beat fluctuations (still averaging 60 bpm = higher HRV). The person with higher HRV is typically more adaptable and recovered.

RR intervals—the time in milliseconds between consecutive R-waves in your ECG signal—are the raw data that reveals your nervous system's balance. By analyzing the pattern and variability of these intervals, we can assess parasympathetic tone, stress resilience, and recovery status in ways a simple heart rate number cannot.

## Four HRV Metrics This App Computes

### **rMSSD (Root Mean Square of Successive Differences)**
**Formula:** √(Σ(RR[i] - RR[i-1])² / (N-1))

This is the **primary metric** for parasympathetic tone and is the most sensitive to short-term changes in nervous system state. It measures how much your RR intervals vary from one beat to the next. Higher rMSSD indicates better parasympathetic activation and faster recovery. This app uses rMSSD as the basis for your morning readiness verdict.

### **SDNN (Standard Deviation of NN Intervals)**
**Formula:** √(Σ(RR[i] - mean)² / N)

SDNN captures the *overall* variability of your heart rhythm across the entire 5-minute recording. Unlike rMSSD (which compares consecutive beats), SDNN measures spread across all beats. We use *population* standard deviation (÷N, not ÷N-1) because the RR intervals in a 5-minute recording represent the complete set of your heart behavior during that period, not a sample of a larger population.

### **Mean HR (Mean Heart Rate)**
**Formula:** 60000 / mean(RR intervals), expressed in beats per minute (bpm)

This is simply your average heart rate during the recording. While less nuanced than HRV metrics, mean HR provides useful context: very elevated mean HR can indicate stress or overtraining, while it's also a useful sanity check on the recording quality.

### **pNN50 (Percentage of NN50)**
**Formula:** (count of successive differences > 50ms / total successive differences) × 100

This metric expresses the percentage of beat-to-beat intervals that differ by more than 50ms. Like rMSSD, pNN50 is a marker of parasympathetic activity, and it's included in major HRV guidelines. Higher pNN50 correlates with better recovery and parasympathetic tone.

## Why These Metrics? ESC Task Force Guidelines

These four metrics are rooted in the **2019 ESC (European Society of Cardiology) Task Force guidelines** on HRV measurement and assessment. The ESC recommends rMSSD and pNN50 as the gold standard short-term (5-minute) metrics for research and clinical use. By anchoring this app to these evidence-based standards, you get metrics that are comparable to published research and validated across thousands of studies.

- **rMSSD** → parasympathetic tone & readiness
- **SDNN** → overall heart rhythm stability
- **Mean HR** → context & sanity check
- **pNN50** → corroboration of parasympathetic state

Together, these four metrics give you a complete picture of your cardiac autonomic state each morning.
