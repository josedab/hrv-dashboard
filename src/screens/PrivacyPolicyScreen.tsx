import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

export function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: April 2026</Text>

      <Text style={styles.heading}>Overview</Text>
      <Text style={styles.body}>
        HRV Readiness Dashboard ("the App") is a personal health monitoring tool that connects to
        Bluetooth heart rate monitors to measure heart rate variability (HRV). Your privacy is
        fundamental to how this app is designed.
      </Text>

      <Text style={styles.heading}>Data Collection</Text>
      <Text style={styles.body}>
        The App collects the following data during use:{'\n\n'}• Heart rate and RR interval data
        from your connected Bluetooth heart rate monitor{'\n'}• HRV metrics computed from your
        recordings (rMSSD, SDNN, mean heart rate, pNN50){'\n'}• Readiness verdicts based on your
        personal baseline{'\n'}• Optional subjective data you enter: perceived readiness rating,
        training type, and notes{'\n'}• App settings and preferences
      </Text>

      <Text style={styles.heading}>Data Storage</Text>
      <Text style={styles.body}>
        All data is stored locally on your device only. The App does not transmit any data to
        external servers, cloud services, or third parties. There are no user accounts, no cloud
        sync, and no analytics services.{'\n\n'}
        Your data remains entirely on your device and under your control.
      </Text>

      <Text style={styles.heading}>Bluetooth</Text>
      <Text style={styles.body}>
        The App uses Bluetooth Low Energy (BLE) to communicate with your heart rate monitor. On
        Android, this requires location permission due to operating system requirements — the App
        does not actually access or store your location.{'\n\n'}
        Bluetooth is used solely to receive heart rate and RR interval data from your sensor during
        active recording sessions.
      </Text>

      <Text style={styles.heading}>Data Export</Text>
      <Text style={styles.body}>
        You can export your session data as a CSV file via the Settings screen. This file is shared
        through your device's native share sheet — the App does not control where you choose to save
        or send the exported data.
      </Text>

      <Text style={styles.heading}>Data Deletion</Text>
      <Text style={styles.body}>
        Uninstalling the App will permanently delete all stored data. There is no way to recover
        data after uninstallation since no copies exist elsewhere.
      </Text>

      <Text style={styles.heading}>Third-Party Services</Text>
      <Text style={styles.body}>
        The App does not integrate with any third-party services, analytics platforms, advertising
        networks, or social media. No data is shared with any third party.
      </Text>

      <Text style={styles.heading}>Children's Privacy</Text>
      <Text style={styles.body}>
        The App is not directed at children under 13. It is designed for adults who engage in
        athletic training.
      </Text>

      <Text style={styles.heading}>Changes to This Policy</Text>
      <Text style={styles.body}>
        Any changes to this privacy policy will be reflected in an app update. The "Last updated"
        date at the top will be revised accordingly.
      </Text>

      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.body}>
        If you have questions about this privacy policy, please reach out via the app's support
        channel on the App Store or Play Store listing.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  updated: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 24,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});
