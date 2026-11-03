/**
 * The onboarding calendar step says what was saved, not what was tapped
 * (HP05, cause fix 18).
 *
 * It marked the calendar connected before saving the choice and kept the mark
 * when the save failed; coming back to the step showed nothing connected
 * whatever had been saved. What it shows now comes from the saved settings.
 *
 * And it is two sentences and the calendar's card (T-022): the privacy
 * promise once, "Set up later" a button with where to set it up later under
 * it, and no English left in its texts.
 */
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import CalendarSyncScreen from '../CalendarSyncScreen';
import { getDeviceCalendars } from '../../../../shared/services/calendar';
import { translations } from '../../../../i18n/translations';

const t = translations.en;
const mockLanguage = { current: 'en' };

jest.mock('../../../../shared/services/calendar', () => ({
  checkCalendarPermissions: jest.fn().mockResolvedValue(true),
  requestCalendarPermissions: jest.fn().mockResolvedValue(true),
  getDeviceCalendars: jest.fn(),
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
// The step's frame, reduced to the texts and the one action it is given.
jest.mock('../../components', () => {
  const { Text: MockText, TouchableOpacity } = require('react-native');
  return {
    OnboardingStep: ({ title, description, children, secondaryAction }: any) => (
      <>
        <MockText>{title}</MockText>
        <MockText>{description}</MockText>
        {children}
        {secondaryAction && (
          <TouchableOpacity testID="secondary-action" onPress={secondaryAction.onPress}>
            <MockText>{secondaryAction.title}</MockText>
          </TouchableOpacity>
        )}
        {secondaryAction?.note && <MockText>{secondaryAction.note}</MockText>}
      </>
    ),
  };
});
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));

const HOME = { id: 'cal-1', title: 'Home', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } };

beforeEach(async () => {
  jest.clearAllMocks();
  mockLanguage.current = 'en';
  (getDeviceCalendars as jest.Mock).mockResolvedValue([HOME]);
  await AsyncStorage.clear();
});

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const openStep = async (waitFor_ = t.onboarding.calendarSync.apple) => {
  const view = render(<CalendarSyncScreen navigation={navigation as any} route={{} as any} />);
  await waitFor(() => view.getByText(waitFor_));
  return view;
};

it('does not show the calendar connected when its choice could not be saved', async () => {
  const view = await openStep();
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('Disk full')));

  await act(async () => { fireEvent.press(view.getByText(t.onboarding.calendarSync.apple)); });

  expect(view.queryByTestId('onboarding-calendar-connected')).toBeNull();
  expect(view.getByTestId('onboarding-calendar-card')).toBeTruthy();
});

it('shows the calendar connected once its choice is saved', async () => {
  const view = await openStep();

  await act(async () => { fireEvent.press(view.getByText(t.onboarding.calendarSync.apple)); });

  expect(view.getByTestId('onboarding-calendar-connected')).toBeTruthy();
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

  await waitFor(() => view.getByTestId('onboarding-calendar-connected'));
});

const texts = (view: ReturnType<typeof render>) =>
  view.UNSAFE_getAllByType(Text).map((node) => [node.props.children].flat().join(''));

it('promises privacy once: in the description, with no box of its own', async () => {
  const view = await openStep();
  expect(texts(view).filter((text) => /never/.test(text))).toEqual([t.onboarding.calendarSync.description]);
  expect(t.onboarding.calendarSync.description.split(/(?<=\.)\s+/)).toHaveLength(2);
});

it('"Set up later" is a button that goes on, with the Profile path under it', async () => {
  const view = await openStep();

  expect(view.getByText('You can do it later in Profile → Calendar Sync')).toBeTruthy();
  fireEvent.press(view.getByTestId('secondary-action'));
  expect(view.getByText(t.onboarding.calendarSync.setupLater)).toBeTruthy();
  expect(navigation.navigate).toHaveBeenCalledWith('Notifications');
});

it('names the Profile path by the Profile\'s own labels, in Russian too', async () => {
  mockLanguage.current = 'ru';
  const ru = translations.ru;
  const view = await openStep(ru.onboarding.calendarSync.apple);
  expect(view.getByText(`Это можно сделать потом: ${ru.nav.profile} → ${ru.calendarSync.title}`)).toBeTruthy();
});

it('says "no calendars" in the app\'s language', async () => {
  mockLanguage.current = 'ru';
  (getDeviceCalendars as jest.Mock).mockResolvedValue([]);
  const view = await openStep('Календари не найдены');
  expect(view.queryByText('No calendars found')).toBeNull();
});

it('says why it needs the calendar in the app\'s language when refused', async () => {
  mockLanguage.current = 'ru';
  const calendar = require('../../../../shared/services/calendar');
  calendar.checkCalendarPermissions.mockResolvedValueOnce(false);
  calendar.requestCalendarPermissions.mockResolvedValueOnce(false);
  const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => undefined);
  const ru = translations.ru;
  const view = await openStep(ru.onboarding.calendarSync.grantPermission);

  await act(async () => { fireEvent.press(view.getByText(ru.onboarding.calendarSync.grantPermission)); });

  expect(alert).toHaveBeenCalledWith(ru.onboarding.calendarSync.permissionRequired, ru.calendarSync.permissionDeniedMessage);
  alert.mockRestore();
});

it('says it is setting the calendar up in the app\'s language', async () => {
  mockLanguage.current = 'de';
  const view = await openStep(translations.de.onboarding.calendarSync.apple);
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));

  await act(async () => { fireEvent.press(view.getByText(translations.de.onboarding.calendarSync.apple)); });

  expect(view.getByText('Kalendersynchronisation wird eingerichtet …')).toBeTruthy();
  expect(view.queryByText('Setting up calendar sync...')).toBeNull();
});
