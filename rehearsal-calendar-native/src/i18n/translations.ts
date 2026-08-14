import * as common from './translations/common';
import * as auth from './translations/auth';
import * as calendar from './translations/calendar';
import * as projects from './translations/projects';
import * as profile from './translations/profile';
import * as availability from './translations/availability';
import * as calendarSync from './translations/calendarSync';
import * as onboarding from './translations/onboarding';
import * as subscriptions from './translations/subscriptions';

export type Language = 'ru' | 'en' | 'es' | 'de';

export interface Translations {
  // Common
  common: common.CommonTranslations;
  // Navigation
  nav: common.NavTranslations;
  // Action Sheet
  actionSheet: common.ActionSheetTranslations;
  // Auth
  auth: auth.AuthTranslations;
  // Calendar
  calendar: calendar.CalendarTranslations;
  // Projects
  projects: projects.ProjectsTranslations;
  // Profile
  profile: profile.ProfileTranslations;
  // Rehearsals
  rehearsals: calendar.RehearsalsTranslations;
  // Availability
  availability: availability.AvailabilityTranslations;
  // Smart Planner
  smartPlanner: availability.SmartPlannerTranslations;
  // Calendar Sync
  calendarSync: calendarSync.CalendarSyncTranslations;
  // Onboarding
  onboarding: onboarding.OnboardingTranslations;
  // Subscriptions
  subscriptions: subscriptions.SubscriptionsTranslations;
  // Beta Banner
  betaBanner: common.BetaBannerTranslations;
  // Days
  days: common.DaysTranslations;
  // Months
  months: string[];
}

export const ru: Translations = {
  ...common.ru,
  ...auth.ru,
  ...calendar.ru,
  ...projects.ru,
  ...profile.ru,
  ...availability.ru,
  ...calendarSync.ru,
  ...onboarding.ru,
  ...subscriptions.ru,
};

export const en: Translations = {
  ...common.en,
  ...auth.en,
  ...calendar.en,
  ...projects.en,
  ...profile.en,
  ...availability.en,
  ...calendarSync.en,
  ...onboarding.en,
  ...subscriptions.en,
};

export const es: Translations = {
  ...common.es,
  ...auth.es,
  ...calendar.es,
  ...projects.es,
  ...profile.es,
  ...availability.es,
  ...calendarSync.es,
  ...onboarding.es,
  ...subscriptions.es,
};

export const de: Translations = {
  ...common.de,
  ...auth.de,
  ...calendar.de,
  ...projects.de,
  ...profile.de,
  ...availability.de,
  ...calendarSync.de,
  ...onboarding.de,
  ...subscriptions.de,
};

export const translations: Record<Language, Translations> = { ru, en, es, de };
