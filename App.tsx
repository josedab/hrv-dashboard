import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { getDatabase } from './src/database/database';
import { initCrashReporting } from './src/utils/crashReporting';
import { COLORS } from './src/constants/colors';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      try {
        initCrashReporting();
        const db = await getDatabase();
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM settings WHERE key = ?',
          'onboarding_complete'
        );
        setShowOnboarding(!row || row.value !== 'true');
        setReady(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize';
        setError(message);
        console.error('App init error:', err);
      }
    }
    init();
  }, []);

  const handleOnboardingComplete = async () => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        'onboarding_complete',
        'true'
      );
      setShowOnboarding(false);
    } catch (err) {
      console.error('Failed to save onboarding state:', err);
      // Still allow the user to proceed even if save fails
      setShowOnboarding(false);
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <StatusBar style="light" />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen onComplete={handleOnboardingComplete} />
    );
  }

  return (
    <ErrorBoundary>
      <AppNavigator />
      <StatusBar style="light" />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});
