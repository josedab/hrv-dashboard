---
sidebar_position: 7
---

# Troubleshooting & FAQ

## Common Issues

### BLE Not Finding Device

**Problem**: Bluetooth scan shows no devices, or Polar H10 doesn't appear.

**Solutions** (in order):
1. **Restart Bluetooth**: Turn off Bluetooth on phone, wait 10 seconds, turn back on
2. **Check device power**: Ensure Polar H10 is powered on (LED should blink)
3. **Check device battery**: Replace battery if LED is dim/no blink
4. **Wet electrodes**: Polar H10 requires skin contact. Wet the metal chest straps with water or electrode gel
5. **Reduce distance**: Move phone within ~2 meters of Polar H10
6. **Restart app**: Force close and reopen HRV Dashboard
7. **Restart phone**: Full phone restart often resets Bluetooth stack
8. **Check permissions**: Go to Settings > Apps > HRV Dashboard > Permissions, ensure Bluetooth and Location are granted
9. **Try another device**: Borrow a friend's Polar H10 to confirm issue is with your device, not the app

**If still not found**: 
- Polar H10 may need factory reset (see [Polar support](https://support.polar.com/))
- Contact hardware support; app scan is standard Bluetooth (no app-level filtering)

---

### "Building Baseline" Message Appears

**Problem**: App shows "Building Baseline" instead of readiness verdict.

**Explanation**: The baseline requires at least **5 previous HRV readings** from the past 30 days. On first use, no baseline exists.

**Solution**: 
- Record HRV readings for 5+ consecutive mornings
- After 5 readings, baseline will be calculated automatically
- Verdict will appear on the 6th reading

**Expected timeline**: One reading per morning × 5 days = baseline ready by day 5.

---

### High Artifact Rate (>40%)

**Problem**: Session completes, but artifact rate shows >40%; metric values seem unreliable.

**Causes & Solutions**:
1. **Poor strap contact**: 
   - Remove Polar H10 strap
   - Wet the metal chest electrodes with water or electrode gel
   - Re-attach strap snugly (should be firm, not painfully tight)
2. **Dry skin**: 
   - Dampen your chest where strap sits
   - Avoid placing strap over very dry/calloused skin
3. **Movement during recording**: 
   - Remain still during 5-minute recording
   - Avoid arm movements, talking, or shifting position
4. **Phone interference**: 
   - Ensure phone is not being held against chest
   - Keep phone at arm's length during recording
5. **Low battery**: 
   - Replace Polar H10 battery if LED blinks faintly

**Action**: Re-do recording after addressing one of the above. Artifact rate should drop to under 10%.

---

### App Crashes on Launch

**Problem**: App closes immediately after opening, or crashes on home screen.

**Solutions** (in order):
1. **Force close and reopen**: 
   - iOS: Swipe up from bottom of screen to close; reopen app
   - Android: Settings > Apps > HRV Dashboard > Force Stop; reopen app
2. **Clear app cache**: 
   - iOS: Settings > General > iPhone Storage > HRV Dashboard > Offload App (then reinstall)
   - Android: Settings > Apps > HRV Dashboard > Storage > Clear Cache
3. **Check device storage**: Ensure your phone has >100 MB free space
4. **Clean rebuild**:
   ```bash
   npx expo prebuild --clean
   npm run build
   ```
5. **Reinstall app**: 
   - Uninstall completely
   - Restart phone
   - Reinstall from app store or via `expo run:ios` / `expo run:android`

**If crash persists**:
- Check device logs (Android: `adb logcat`, iOS: Console app)
- Open an issue with logs at [GitHub](https://github.com/yourusername/hrv-dashboard/issues)

---

### Readings Seem Inconsistent

**Problem**: Verdicts fluctuate wildly day-to-day; readings don't seem comparable.

**Causes & Solutions**:
1. **Inconsistent routine**: 
   - Record at the same time each morning (within 30 min window)
   - HRV varies throughout the day; morning baseline is most stable
2. **Inconsistent position**: 
   - Always record sitting upright, or always lying down
   - Postural changes affect HRV measurement
3. **Variables not logged**: 
   - Enter sleep hours, sleep quality, stress level before recording
   - These context clues help interpret why RMSSD varies
4. **Recording technique**: 
   - Ensure strap is secure (see "High Artifact Rate" above)
   - Don't move during recording
5. **Baseline noise**: 
   - If you have fewer than 10 readings, baseline can shift as new data is added
   - Once you reach 20–30 readings, baseline stabilizes

**Best practice**: 
- Record between 6–8 AM, before coffee/exercise
- Stay still during 5-minute recording
- Log sleep/stress for context

---

## Frequently Asked Questions

### Q: Does the app work with Apple Watch?

**A**: No. The app only supports **BLE Heart Rate Service**, which is not available on Apple Watch. Apple Watch uses HealthKit (proprietary iOS framework), not standard Bluetooth.

**Workaround**: Wear a Polar H10 strap in addition to Apple Watch during HRV recording.

---

### Q: Can I run the app in a simulator?

**A**: No. Bluetooth (BLE) requires a physical device and cannot be emulated.

**Setup**: 
- iOS: Run on real iPhone/iPad via Xcode or `expo run:ios`
- Android: Run on real Android phone/tablet via Android Studio or `expo run:android`

Simulators: Cannot connect to BLE peripherals.

---

### Q: Where is my data stored?

**A**: All data is stored **locally on your device** in a SQLite database. 

- **No cloud**: Data never leaves your phone
- **No accounts**: No username/password required
- **Private**: Only accessible to this app
- **Backup**: Automatic via iOS iCloud or Android system backup

**Export**: Tap Menu (LogScreen) → "Export to CSV" to download readings as a spreadsheet.

---

### Q: Can I sync readings across my multiple devices (phone, tablet)?

**A**: No. Each device has its own local database with separate readings and baseline.

**Workaround**: 
- Export readings from one device (CSV)
- Email or cloud-share the file
- Import manually to other device (feature may be added in future)

---

### Q: How do I export my data?

**A**: 
1. Open the **Log** tab (history of sessions)
2. Tap **Menu** (three dots, top right)
3. Select **"Export to CSV"**
4. File is saved to your device's Downloads folder
5. Share/email as needed

**CSV format**: Columns include timestamp, duration, metrics (RMSSD, SDNN, mean_hr, pnn50), verdict, sleep/stress context, and notes.

---

### Q: Can I delete a recording?

**A**: Yes. 
1. Go to **Log** tab
2. Swipe left on a session (iOS) or long-press (Android)
3. Tap **Delete**
4. Confirm deletion

**Note**: Deleted sessions cannot be recovered. Baseline will recalculate with remaining data.

---

### Q: How accurate are the HRV metrics?

**A**: 
- **Accuracy depends on**:
  - Sensor quality (Polar H10 is medical-grade)
  - Strap fit and electrode contact
  - Recording consistency (same time, same position each day)
- **Comparison baseline**: Your own readings are compared to your own baseline, not population norms. This personal approach is more meaningful than absolute "normal" values.
- **Research backing**: RMSSD and SDNN are scientifically validated HRV metrics used in peer-reviewed sports science.

**Recommendations**:
- Treat the verdict as a relative trend, not an absolute truth
- Use it as one input to your training decisions, alongside other factors (sleep, fatigue, mood)
- After first 2–3 weeks, you'll recognize patterns in your own data

---

### Q: What's the difference between "Go Hard," "Moderate," and "Rest"?

**A**: Verdicts are based on your **current RMSSD compared to your personal baseline**:

- **Go Hard** (RMSSD ≥ 100% of baseline): High parasympathetic tone suggests good recovery; optimal for intense training or testing.
- **Moderate** (RMSSD 75–100% of baseline): Adequate recovery; suitable for normal training, with potential to push harder.
- **Rest** (RMSSD < 75% of baseline): Low HRV suggests fatigue or stress; prioritize recovery, lighter training, or rest day.

**Not diagnosis**: These are training readiness indicators, not medical advice. If you're unwell, follow your symptoms and judgment.

---

### Q: Can I adjust the thresholds for verdicts?

**A**: Yes, in future versions. Currently, thresholds are fixed (1.0× for Go Hard, 0.75× for Moderate). 

**Workaround** (manual interpretation):
- Note your baseline RMSSD (visible on home screen)
- Use the formula: `Verdict = RMSSD ÷ baseline`
- Adjust personal thresholds based on your own experience

**Planned feature**: Settings screen will allow threshold customization in v2.

---

### Q: What should I do if I don't like the verdict?

**A**: Verdicts are data-driven, not opinions. If you disagree:

1. **Check data quality**: Was artifact rate high? Did you move during recording? Were conditions inconsistent?
2. **Check baseline**: Do you think your baseline is accurate? (If < 10 readings, it's still being built)
3. **Trust the signal**: HRV is a physiological measure of nervous system state. If the app says "Rest," your body likely needs it.
4. **Make your own call**: Use the verdict as input, not gospel. You know your body best.

---

### Q: I want to change my baseline. How?

**A**: 
- The baseline automatically recalculates every time a new reading is added, using the **most recent 30 days**.
- To shift baseline quickly, log extra readings for a few days during the state you want to baseline against.
- Custom baseline window (e.g., 14 days vs. 30) will be configurable in v2.

---

### Q: The app crashes when I try to export. Help?

**A**: 
1. Ensure you have >100 MB free storage on device
2. Go to **Settings** > **Apps** > **HRV Dashboard** > **Storage** > **Clear Cache**
3. Try export again
4. If still fails, try exporting fewer records (e.g., last month instead of all-time)

---

### Q: I have a question not answered here.

**A**: Great! Please open an issue on [GitHub](https://github.com/yourusername/hrv-dashboard/issues) with details, and the maintainers will help.

