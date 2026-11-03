import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen, WhatWhereScreen, CalendarSyncScreen, NotificationsScreen } from '../screens';

/**
 * Order matters here. Settings used to come before meaning and permissions
 * before any reason to grant them; now the app explains itself, then asks for
 * what it needs, and last says where things are. The week's first day is no
 * step: it is the phone's, written to the profile on the last step (T-022).
 */
export type OnboardingStackParamList = {
  Welcome: undefined;
  CalendarSync: undefined;
  Notifications: undefined;
  WhatWhere: undefined;
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
      <OnboardingStack.Screen name="WhatWhere" component={WhatWhereScreen} />
    </OnboardingStack.Navigator>
  );
}
