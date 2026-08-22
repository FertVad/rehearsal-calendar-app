import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen, WeekStartScreen, CalendarSyncScreen, NotificationsScreen } from '../screens';

/**
 * Order matters here. Settings used to come before meaning and permissions
 * before any reason to grant them; now the app explains itself, then asks for
 * what it needs, and the cosmetic setting goes last.
 */
export type OnboardingStackParamList = {
  Welcome: undefined;
  CalendarSync: undefined;
  Notifications: undefined;
  WeekStart: undefined;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <OnboardingStack.Screen name="Welcome" component={WelcomeScreen} />
      <OnboardingStack.Screen name="CalendarSync" component={CalendarSyncScreen} />
      <OnboardingStack.Screen name="Notifications" component={NotificationsScreen} />
      <OnboardingStack.Screen name="WeekStart" component={WeekStartScreen} />
    </OnboardingStack.Navigator>
  );
}
