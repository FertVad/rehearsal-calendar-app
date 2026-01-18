import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen, WeekStartScreen, CalendarSyncScreen } from '../screens';

export type OnboardingStackParamList = {
  Welcome: undefined;
  WeekStart: undefined;
  CalendarSync: undefined;
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
      <OnboardingStack.Screen name="WeekStart" component={WeekStartScreen} />
      <OnboardingStack.Screen name="CalendarSync" component={CalendarSyncScreen} />
    </OnboardingStack.Navigator>
  );
}
