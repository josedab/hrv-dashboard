import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { COLORS } from '../../../constants/colors';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { settingsStyles as s } from '../styles';

const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ??
  // @ts-expect-error legacy manifest path on classic builds
  (Constants.manifest?.version as string | undefined) ??
  '1.0.0';

const NAV_ITEMS: ReadonlyArray<{ screen: keyof RootStackParamList; label: string }> = [
  { screen: 'SyncSettings', label: 'Cloud Sync' },
  { screen: 'ShareCoach', label: 'Share with Coach' },
  { screen: 'Plugins', label: 'Plugins' },
  { screen: 'Coherence', label: 'Coherence Training' },
  { screen: 'PrivacyPolicy', label: 'Privacy Policy' },
];

/**
 * Footer with the app version banner and navigation buttons to
 * secondary settings screens (cloud sync, share, plugins, etc.).
 */
export function NavSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <>
      <View style={local.about}>
        <Text style={local.aboutText}>HRV Readiness Dashboard v{APP_VERSION}</Text>
        <Text style={local.aboutText}>Uses Polar H10 via Heart Rate Service</Text>
      </View>

      {NAV_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={s.exportButton}
          onPress={() => navigation.navigate(item.screen as never)}
          activeOpacity={0.7}
        >
          <Text style={s.exportButtonText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </>
  );
}

const local = StyleSheet.create({
  about: {
    marginTop: 40,
    alignItems: 'center',
    gap: 4,
  },
  aboutText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
