import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TrendsScreen } from '../screens/TrendsScreen';
import { ReadingScreen } from '../screens/ReadingScreen';
import { LogScreen } from '../screens/LogScreen';
import { SessionDetailScreen } from '../screens/SessionDetailScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { OrthostaticScreen } from '../screens/OrthostaticScreen';
import { CameraReadingScreen } from '../screens/CameraReadingScreen';
import { COLORS } from '../constants/colors';
import { STRINGS } from '../constants/strings';

export type RootStackParamList = {
  Tabs: undefined;
  Reading: undefined;
  CameraReading: undefined;
  Log: { sessionId: string };
  SessionDetail: { sessionId: string };
  PrivacyPolicy: undefined;
  Orthostatic: undefined;
};

export type TabParamList = {
  Home: undefined;
  Trends: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'heart',
  Trends: 'trending-up',
  History: 'list',
  Settings: 'settings-sharp',
};

function TabIcon({ name, focused }: { name: keyof TabParamList; focused: boolean }) {
  return (
    <Ionicons
      name={TAB_ICONS[name]}
      size={22}
      color={focused ? COLORS.accent : COLORS.textMuted}
    />
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarAccessibilityLabel: route.name,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 80,
          paddingBottom: 20,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name as keyof TabParamList} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: STRINGS.tabHome }} />
      <Tab.Screen
        name="Trends"
        component={TrendsScreen}
        options={{ tabBarLabel: STRINGS.tabTrends }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: STRINGS.tabHistory }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: STRINGS.tabSettings }}
      />
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
        <Stack.Screen
          name="Reading"
          component={ReadingScreen}
          options={{ title: 'Recording', presentation: 'modal' }}
        />
        <Stack.Screen
          name="CameraReading"
          component={CameraReadingScreen}
          options={{ title: STRINGS.cameraReading, presentation: 'modal' }}
        />
        <Stack.Screen
          name="Log"
          component={LogScreen}
          options={{ title: 'Log Session', presentation: 'modal' }}
        />
        <Stack.Screen
          name="SessionDetail"
          component={SessionDetailScreen}
          options={{ title: 'Session Details' }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ title: STRINGS.privacyTitle }}
        />
        <Stack.Screen
          name="Orthostatic"
          component={OrthostaticScreen}
          options={{ title: STRINGS.orthostaticTest, presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
