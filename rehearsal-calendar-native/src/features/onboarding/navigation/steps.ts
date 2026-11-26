import type { ComponentType } from 'react';
import { WelcomeScreen, WeekendsScreen, CalendarSyncScreen, NotificationsScreen, WhatWhereScreen } from '../screens';
import type { OnboardingStackParamList } from './OnboardingNavigator';

/**
 * The onboarding's steps, in their order — the stack is built from this list
 * and nothing else, so a test that walks it walks every step, a step added
 * later too (T-412: one design on every step).
 */
export const ONBOARDING_STEPS: ReadonlyArray<{
  name: keyof OnboardingStackParamList;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
}> = [
  { name: 'Welcome', component: WelcomeScreen },
  { name: 'Weekends', component: WeekendsScreen },
  { name: 'CalendarSync', component: CalendarSyncScreen },
  { name: 'Notifications', component: NotificationsScreen },
  { name: 'WhatWhere', component: WhatWhereScreen },
];
