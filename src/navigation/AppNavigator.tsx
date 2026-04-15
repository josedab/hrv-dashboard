import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ReadingScreen } from '../screens/ReadingScreen';
import { LogScreen } from '../screens/LogScreen';
import { SessionDetailScreen } from '../screens/SessionDetailScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { COLORS } from '../constants/colors';

export type RootStackParamList = {
  Tabs: undefined;
  Reading: undefined;
  Log: { sessionId: string };
  SessionDetail: { sessionId: string };
  PrivacyPolicy: undefined;
};

export type TabParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { Home: '❤️', History: '📊', Settings: '⚙️' };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] || '•'}</Text>;
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 80,
          paddingBottom: 20,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Reading" component={ReadingScreen} options={{ title: 'Recording', presentation: 'modal' }} />
        <Stack.Screen name="Log" component={LogScreen} options={{ title: 'Log Session', presentation: 'modal' }} />
        <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ title: 'Session Details' }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
