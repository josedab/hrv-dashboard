# App Store Reviewer Notes

## Summary

HRV Morning Readiness Dashboard is a fitness/wellness app that pairs
with a Polar H10 (or compatible) Bluetooth chest strap, records 2-min
heart-rate variability readings, and gives the athlete a daily training
verdict (Go Hard / Moderate / Rest).

All physiological data is processed and stored locally; there is no
backend. There are no in-app purchases.

## Demo Account

No account is required. The app launches into onboarding the first
time and proceeds straight to the dashboard.

## Demo Mode (No Hardware Required)

To evaluate without a chest strap:

1. Open the app and complete onboarding (3 swipes).
2. From **Settings → Developer → Enable Demo Mode**, toggle on.
3. Restart the app. The home screen will show 30 days of synthetic
   sessions and the Reading screen will simulate an RR-interval stream
   when you tap **Start Reading**.

The verdict, baseline math, breathing exercise, and history charts all
behave identically to real readings.

## Required Permissions

| Permission         | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| Bluetooth          | Connect to the Polar H10 chest strap                          |
| Camera (optional)  | PPG fallback when no strap is available                      |
| Notifications      | Morning reading reminder + post-reading verdict summary      |
| Apple Health (opt) | Two-way sync of HRV / RHR / sleep                            |

The app degrades gracefully when any of these is denied.

## Third-Party SDKs

- `expo-*` (MIT, runtime)
- `react-native-ble-plx` (Apache-2.0)
- `@sentry/react-native` (BSD-3, **only loaded if user opts into crash reporting**)

## Contact

reviewer@hrv-dashboard.example
