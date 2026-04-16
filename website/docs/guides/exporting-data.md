---
sidebar_position: 3
title: Exporting Data
---

# Exporting Data

All your HRV data is stored locally on your device. This guide explains how to export it and what the data format looks like.

## How to Export

1. Open the app and navigate to the **Settings** screen.
2. Scroll down to the **Export Data** section.
3. Tap **Export to CSV**.
4. The app generates a CSV file with all your HRV sessions and saves it to your device's file system (typically your Downloads folder or the Files app).
5. You can then share, email, or back up this file.

Exporting does not delete any data from your device — it's a read-only operation. You can export as many times as you want.

## CSV Format and Columns

The exported CSV file contains one row per HRV measurement session. Here are the columns:

| Column | Format | Description |
|--------|--------|-------------|
| `id` | UUID | Unique identifier for this session |
| `timestamp` | ISO 8601 | Date and time the measurement was recorded (e.g., `2024-01-15T06:30:00Z`) |
| `duration_seconds` | Integer | How long the HRV measurement took (typically 60–120 seconds) |
| `rmssd` | 2 decimal places | Root Mean Square of Successive Differences — your primary HRV metric |
| `sdnn` | 2 decimal places | Standard Deviation of NN intervals |
| `mean_hr` | 1 decimal place | Average heart rate during the measurement (beats per minute) |
| `pnn50` | 1 decimal place | Percentage of successive RR intervals differing by >50ms |
| `artifact_rate` | 4 decimal places | Proportion of detected artifacts (e.g., `0.0234` = 2.34%) |
| `verdict` | Text | Today's verdict: `"Go Hard"`, `"Moderate"`, or `"Rest"` |
| `perceived_readiness` | Integer (1–5) | Your subjective readiness score |
| `training_type` | Text | Type of training planned: e.g., `"Strength"`, `"Endurance"`, `"Sport"`, `"Rest"` |
| `notes` | Text | Any free-form notes you entered |
| `rr_interval_count` | Integer | Number of RR intervals recorded during the measurement |
| `sleep_hours` | Decimal | Hours of sleep reported |
| `sleep_quality` | Integer (1–5) | Subjective sleep quality rating |
| `stress_level` | Integer (1–5) | Subjective stress level rating |

## Using Exported Data

### Spreadsheet Analysis

1. **Open in Excel, Google Sheets, or Numbers**: Import the CSV file directly.
2. **Create charts**: Plot rMSSD over time, correlate with sleep hours or stress level, or compare training types.
3. **Calculate statistics**: Average rMSSD by training type, trend analysis, correlation with subjective metrics.

### Advanced Analysis Tools

You can also import the CSV into:
- **Python** (pandas, matplotlib) — For custom analysis and machine learning.
- **R** — For statistical analysis and visualization.
- **Google Colab** — For collaborative data science workflows.
- **Tableau or Power BI** — For interactive dashboards.

### Data Backup

Regularly exporting and storing your CSV file is a good backup practice. While your data is safe on your device, having an off-device copy protects against accidental deletion or device loss.

## Important: Data Stays Local

**All your HRV data remains on your device.** The HRV Morning Readiness Dashboard does not:
- Upload data to any server
- Send data to the cloud
- Share data with third parties
- Collect analytics or tracking data

**Exporting is the only way to get your data off the device.** This is by design — your health data is yours alone.

---

**Next steps**: Explore [Settings & Customization](./settings-and-customization.md) to learn how to fine-tune the app to your needs.
