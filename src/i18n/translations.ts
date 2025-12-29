import * as common from './translations/common';
import * as auth from './translations/auth';
import * as calendar from './translations/calendar';
import * as projects from './translations/projects';
import * as profile from './translations/profile';
import * as availability from './translations/availability';
import * as calendarSync from './translations/calendarSync';

export type Language = 'ru' | 'en';

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
};

export const en: Translations = {
  ...common.en,
  ...auth.en,
  ...calendar.en,
  ...projects.en,
  ...profile.en,
  ...availability.en,
  ...calendarSync.en,
};

export const translations: Record<Language, Translations> = { ru, en };
