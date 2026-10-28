/**
 * The onboarding calendar step says what was saved, not what was tapped
 * (HP05, cause fix 18).
 *
 * It marked the calendar connected before saving the choice and kept the mark
 * when the save failed; coming back to the step showed nothing connected
 * whatever had been saved. What it shows now comes from the saved settings.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import CalendarSyncScreen from '../CalendarSyncScreen';
import { translations } from '../../../../i18n/translations';

const t = translations.en;

jest.mock('../../../../shared/services/calendar', () => ({
  checkCalendarPermissions: jest.fn().mockResolvedValue(true),
  requestCalendarPermissions: jest.fn().mockResolvedValue(true),
  getDeviceCalendars: jest.fn().mockResolvedValue([
    { id: 'cal-1', title: 'Home', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } },
  ]),
  getDefaultCalendar: jest.fn().mockResolvedValue(null),
  importCalendarEventsToAvailability: jest.fn(),
  syncAllRehearsals: jest.fn(),
  removeAllExportedEvents: jest.fn(),
  removeAllImportedSlots: jest.fn(),
  syncRehearsalToCalendar: jest.fn(),
  unsyncRehearsal: jest.fn(),
}));
jest.mock('../../../../shared/utils/calendarMappings', () => ({ getAllMappings: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../../shared/services/api', () => ({ projectsAPI: {}, rehearsalsAPI: {} }));
jest.mock('../../hooks/useOnboarding', () => ({ useOnboarding: () => ({ skipOnboarding: jest.fn() }) }));
jest.mock('../../components', () => ({ OnboardingStep: ({ children }: any) => children }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

const openStep = async () => {
  const view = render(<CalendarSyncScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any} route={{} as any} />);
  await waitFor(() => view.getByText(t.onboarding.calendarSync.apple));
  return view;
};

it('does not show the calendar connected when its choice could not be saved', async () => {
  const view = await openStep();
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('Disk full')));

  await act(async () => { fireEvent.press(view.getByText(t.onboarding.calendarSync.apple)); });

  expect(view.queryByText(t.onboarding.calendarSync.connectedBody)).toBeNull();
  expect(view.getByText(t.onboarding.calendarSync.manualBody)).toBeTruthy();
});

it('shows the calendar connected once its choice is saved', async () => {
  const view = await openStep();

  await act(async () => { fireEvent.press(view.getByText(t.onboarding.calendarSync.apple)); });

  expect(view.getByText(t.onboarding.calendarSync.connectedBody)).toBeTruthy();
});

it('shows a calendar connected earlier as connected on coming back', async () => {
  await AsyncStorage.setItem('calendar-sync-settings', JSON.stringify({
    exportEnabled: true,
    exportCalendarId: 'cal-1',
    lastExportTime: null,
    importEnabled: true,
    importCalendarIds: ['cal-1'],
    importInterval: 'always',
    lastImportTime: null,
  }));

  const view = await openStep();

  await waitFor(() => view.getByText(t.onboarding.calendarSync.connectedBody));
});
