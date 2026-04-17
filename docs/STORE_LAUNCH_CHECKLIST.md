# Store Launch Checklist

End-to-end checklist for shipping HRV Readiness to the **Apple App Store**
and **Google Play**. Work top to bottom; each section gates the next.

## 0. Prerequisites

- [ ] Apple Developer Program membership active (\$99/yr)
- [ ] Google Play Console developer account active (\$25 one-time)
- [ ] EAS account with project linked: `eas init`
- [ ] `eas.json` reviewed; replace `REPLACE_WITH_…` placeholders
- [ ] App Store Connect app record created (matches `bundleIdentifier`)
- [ ] Google Play Console app record created (matches `package`)

## 1. Pre-flight Code Audit

- [ ] `npm test` is green (current: 511 tests)
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run lint` is clean
- [ ] No `console.log` left in user-facing screens (use logger util)
- [ ] No hardcoded API keys or DSNs in source (Sentry uses env var)
- [ ] `app.json > version` bumped (semver)
- [ ] `app.json > ios.buildNumber` and `android.versionCode` bumped

## 2. Permission Strings (`app.json > ios.infoPlist`)

All `NS*UsageDescription` strings must be specific, user-facing, and
truthful. Currently set:

- [x] `NSBluetoothAlwaysUsageDescription`
- [x] `NSBluetoothPeripheralUsageDescription`
- [ ] `NSCameraUsageDescription` — required for PPG camera mode
      (e.g. *"Used to measure heart-rate variability via the camera
      flashlight when no chest strap is available."*)
- [ ] `NSHealthShareUsageDescription` — if HealthKit auto-pull enabled
      (e.g. *"Reads last-night sleep duration to refine your readiness
      score."*)
- [ ] `NSHealthUpdateUsageDescription` — only if writing back HRV
- [ ] `NSMotionUsageDescription` — only if motion sensors used

Reject reason if missing: *Guideline 5.1.1 — Privacy*.

## 3. Privacy Nutrition Labels (App Store)

| Data Type            | Linked? | Tracking? | Purposes               |
|----------------------|---------|-----------|------------------------|
| Health & Fitness     | No      | No        | App Functionality      |
| Identifiers (none)   | —       | —         | —                      |
| Location (none)      | —       | —         | —                      |
| Diagnostics (Sentry) | No      | No        | Analytics, App Func.   |

Confirm in App Store Connect → App Privacy. Already declared in
`app.json > ios.privacyManifests`.

## 4. Google Play Data Safety Form

Mirror the table above. Mark:
- Data collected on-device, never leaves: **Yes** (HRV)
- Data shared with third parties: **No** (unless Sentry enabled)
- Data encrypted in transit: **N/A — local-only** (or **Yes** if sync)
- Users can request deletion: **Yes** (Settings → Erase All Data)

## 5. Assets

- [ ] App icon: 1024x1024 PNG, no transparency (App Store)
- [ ] Adaptive icon: foreground + background (Play)
- [ ] Splash screen renders correctly on notched devices
- [ ] Screenshots (per locale):
  - iPhone 6.7" (1290x2796) — **5 required**
  - iPhone 5.5" (1242x2208) — optional but recommended
  - iPad 12.9" (2048x2732) — only if `supportsTablet: true`
  - Android phone (1080x1920) — **min 2, max 8**
  - Android 7" tablet — optional
  - Android 10" tablet — optional
- [ ] Promotional video (optional, ≤30s, App Preview format)
- [ ] Feature graphic for Play (1024x500)

### Suggested screenshot script

1. **Home** with a recent "Go Hard" verdict
2. **Reading** mid-recording with live HR
3. **History** showing 7-day streak
4. **Trends** with 30-day sparkline + baseline
5. **Settings** showing paired device + thresholds

## 6. Store Copy

- [ ] Short description (Play, 80 chars max)
- [ ] Long description (Play, 4000 chars max)
- [ ] Promotional text (App Store, 170 chars, updatable post-launch)
- [ ] Subtitle (App Store, 30 chars)
- [ ] What's New / Release notes (≤4000 chars)
- [ ] Keywords (App Store only, 100 chars comma-separated)
- [ ] Support URL (e.g. GitHub issues)
- [ ] Marketing URL (optional but boosts conversion)
- [ ] Privacy Policy URL — **mandatory for both stores**

## 7. Build & Submit

```bash
# iOS — TestFlight
eas build --profile production --platform ios
eas submit --profile production --platform ios

# Android — Internal testing
eas build --profile production --platform android
eas submit --profile production --platform android
```

- [ ] iOS build uploaded to App Store Connect
- [ ] Build appears in TestFlight; install on a physical device
- [ ] Android bundle uploaded; promoted to Internal testing track
- [ ] Verify on a non-developer device: BLE pairing, recording,
      verdict computation, history, settings, deep links, share

## 8. Beta Testing

- [ ] Add ≥5 external TestFlight testers (covers iOS reject rate)
- [ ] Open Play Internal track to ≥5 testers via opt-in URL
- [ ] Collect feedback for ≥7 days
- [ ] Triage crash reports in Sentry; ship hotfixes if any P0/P1

## 9. Submit for Review

- [ ] App Store: include reviewer notes
      *"Requires a Polar H10 (or compatible BLE chest strap). For
      review without hardware, use Settings → Demo Mode to inject
      synthetic readings."*
- [ ] Play: same reviewer notes in the IARC questionnaire / details
- [ ] Demographic targeting set (16+ recommended; not for children)
- [ ] Content rating questionnaire completed honestly

## 10. Launch Day

- [ ] Tag release in git: `git tag v1.0.0 && git push --tags`
- [ ] GitHub release notes published
- [ ] Update `README.md` badges to point to live store listings
- [ ] Monitor Sentry for first-24h crash spike
- [ ] Pre-write a v1.0.1 hotfix branch in case of P0

## 11. Post-Launch (within 1 week)

- [ ] Respond to first 10 store reviews (sets ratings algorithm)
- [ ] Add download link to project README
- [ ] Submit to Product Hunt / r/ArtificialIntelligence / r/AdvancedRunning
- [ ] Watch retention curves on day 1 / 7 / 30

---

## Common Rejection Reasons (and how to avoid them)

| Reason                          | Fix                                              |
|---------------------------------|--------------------------------------------------|
| 5.1.1 Missing usage description | Audit every `NS*UsageDescription` (§2)           |
| 4.0 Crashes on launch           | Run `eas build --profile production` locally     |
| 2.1 Reviewer can't reproduce    | Ship Demo Mode + clear reviewer notes (§9)       |
| 1.1.6 Health/medical claims     | Use "informational only" disclaimer in onboarding|
| 5.1.2 Health data export        | Confirm export is on-device only (no servers)    |
