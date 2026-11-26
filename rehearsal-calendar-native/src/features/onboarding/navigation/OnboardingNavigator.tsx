import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ONBOARDING_STEPS } from './steps';

/**
 * Order matters here. Settings used to come before meaning and permissions
 * before any reason to grant them; now the app explains itself, then asks for
 * what it needs, and last says where things are. The week's first day is no
 * step: it is the phone's, written to the profile on the last step (T-022).
 * Where it was, right after the greeting, the weekends are asked about (T-406).
 * The steps are `ONBOARDING_STEPS`, in their order: the stack has no other.
 */
export type OnboardingStackParamList = {
  Welcome: undefined;
  Weekends: undefined;
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
      {ONBOARDING_STEPS.map((step) => (
        <OnboardingStack.Screen key={step.name} name={step.name} component={step.component} />
      ))}
    </OnboardingStack.Navigator>
  );
}
