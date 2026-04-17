# Privacy Policy — HRV Morning Readiness Dashboard

_Last updated: 2026-04-15_

This app is designed to keep your physiological data **on your device**.
We do not run a backend that collects, stores, or analyzes your readings.

## What We Collect

| Category                | Stored Where           | Leaves Device?                                    |
| ----------------------- | ---------------------- | ------------------------------------------------- |
| Heart-rate readings     | Local SQLite           | Only via your manual export / opt-in cloud sync  |
| Subjective inputs       | Local SQLite           | Same as above                                     |
| BLE device pairings     | OS keychain            | No                                                |
| Crash diagnostics       | Sentry (opt-in only)   | Yes, only if you enable the toggle in Settings   |
| Optional cloud backup   | Provider you configure | End-to-end encrypted; we never have decryption keys |

## Health Integrations

If you enable Apple Health or Google Health Connect sync, the app
exchanges sleep, resting heart-rate, and HRV samples with the OS health
store. **Those exchanges happen entirely between your phone and the OS
health database** — no third party is involved.

## Optional Crash Reporting

Sentry is loaded at runtime _only_ if `SENTRY_DSN` is set and you have
opted in. Reports include stack traces and device model. They never
include your raw RR intervals, sessions, or notes.

## Data Deletion

- **In-app**: Settings → Reset all data wipes the SQLite database.
- **Cloud sync**: Settings → Sync → Delete remote bundle removes the
  encrypted blob from your provider; once deleted we have no copy.
- **Email**: privacy@hrv-dashboard.example with your account id (only
  applicable if you enabled cloud sync).

## Children

Not directed at anyone under 13. The app does not knowingly collect
data from children.

## Changes

We will publish updates to this document in the GitHub repository under
`docs/PRIVACY_POLICY.md`. Continued use of the app after a change
constitutes acceptance.
