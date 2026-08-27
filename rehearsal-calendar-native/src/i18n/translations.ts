import * as common from './translations/common';
import * as auth from './translations/auth';
import * as calendar from './translations/calendar';
import * as projects from './translations/projects';
import * as profile from './translations/profile';
import * as availability from './translations/availability';
import * as calendarSync from './translations/calendarSync';
import * as notifications from './translations/notifications';
import * as onboarding from './translations/onboarding';

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
  notifications: notifications.NotificationsTranslations;
  // Onboarding
  onboarding: onboarding.OnboardingTranslations;
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
  ...notifications.ru,
  ...onboarding.ru,
};

export const en: Translations = {
  ...common.en,
  ...auth.en,
  ...calendar.en,
  ...projects.en,
  ...profile.en,
  ...availability.en,
  ...calendarSync.en,
  ...notifications.en,
  ...onboarding.en,
};

export const es: Translations = {
  ...common.es,
  ...auth.es,
  ...calendar.es,
  ...projects.es,
  ...profile.es,
  ...availability.es,
  ...calendarSync.es,
  ...notifications.es,
  ...onboarding.es,
};

export const de: Translations = {
  ...common.de,
  ...auth.de,
  ...calendar.de,
  ...projects.de,
  ...profile.de,
  ...availability.de,
  ...calendarSync.de,
  ...notifications.de,
  ...onboarding.de,
};

export const translations: Record<Language, Translations> = { ru, en, es, de };
