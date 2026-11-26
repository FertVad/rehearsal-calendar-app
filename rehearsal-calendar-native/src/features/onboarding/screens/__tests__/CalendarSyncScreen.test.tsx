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
 *
 * T-412: its answers are at the bottom — "Grant Access" over "Set up later"
 * without access — and with access, the calendar picked is the answer: once
 * connected, its tick shows for a moment and the next step opens. There is no
 * "Next"; it did what "Set up later" did.
 */
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, act, waitFor, within } from '@testing-library/react-native';
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
// The step's real frame, with the real button.
jest.mock('../../../../shared/components', () => ({
  GlassButton: jest.requireActual('../../../../shared/components/buttons/GlassButton').default,
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));

const HOME = { id: 'cal-1', title: 'Home', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } };
const WORK = { id: 'cal-2', title: 'Work', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } };
const NBSP = '\u00a0';

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
  expect(texts(view).filter((text) => /what you’re doing/.test(text))).toHaveLength(1);
  expect(texts(view).filter((text) => /only those hours/.test(text))).toHaveLength(1);
  expect(t.onboarding.calendarSync.description.split(/(?<=\.)\s+/)).toHaveLength(2);
});

it('"Set up later" is the answer at the bottom that goes on, the Profile path whole under it', async () => {
  const view = await openStep();

  const footer = view.getByTestId('onboarding-footer');
  // One piece: no line begins with "→" (settingPath, as on the weekends' step).
  expect(within(footer).getByText(`You can do it later in Profile${NBSP}→${NBSP}Calendar${NBSP}Sync`)).toBeTruthy();
  fireEvent.press(within(footer).getByText(t.onboarding.calendarSync.setupLater));
  expect(navigation.navigate).toHaveBeenCalledWith('Notifications');
});

it('names the Profile path by the Profile\'s own labels, in Russian too', async () => {
  mockLanguage.current = 'ru';
  const ru = translations.ru;
  const view = await openStep(ru.onboarding.calendarSync.apple);
  expect(view.getByText(`Это можно сделать потом: ${ru.nav.profile}${NBSP}→${NBSP}${ru.calendarSync.title}`)).toBeTruthy();
});

it('has no "Next": an answer is what goes on', async () => {
  const view = await openStep();
  expect(view.queryByText(/^Next$/)).toBeNull();
  expect(view.getByTestId('onboarding-footer')).toBeTruthy();
  expect(view.queryByTestId('onboarding-answer')).toBeNull();
});

it('asks for access at the bottom, "Grant Access" over "Set up later"; the card keeps its icon only', async () => {
  const calendar = require('../../../../shared/services/calendar');
  calendar.checkCalendarPermissions.mockResolvedValueOnce(false);
  const view = await openStep(t.onboarding.calendarSync.grantPermission);

  const footer = view.getByTestId('onboarding-footer');
  expect(within(footer).getByText(t.onboarding.calendarSync.grantPermission)).toBeTruthy();
  expect(within(footer).getByText(t.onboarding.calendarSync.setupLater)).toBeTruthy();
  expect(within(view.getByTestId('onboarding-content')).queryByText(t.onboarding.calendarSync.grantPermission)).toBeNull();
  expect(view.getByTestId('onboarding-answer')).toBeTruthy();
});

it('goes on to Notifications once the calendar picked is connected, its tick seen first, within a second', async () => {
  const view = await openStep();

  await act(async () => { fireEvent.press(view.getByText(t.onboarding.calendarSync.apple)); });

  expect(view.getByTestId('onboarding-calendar-connected')).toBeTruthy();
  expect(navigation.navigate).not.toHaveBeenCalled();
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('Notifications'), { timeout: 1000 });
});

it('does not go on when the calendar could not be connected', async () => {
  const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => undefined);
  const view = await openStep();
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('Disk full')));

  await act(async () => { fireEvent.press(view.getByText(t.onboarding.calendarSync.apple)); });
  await new Promise((resolve) => setTimeout(resolve, 700));

  expect(alert).toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  alert.mockRestore();
});

it('only opens the list of a provider with several calendars; the one picked from it goes on', async () => {
  (getDeviceCalendars as jest.Mock).mockResolvedValue([HOME, WORK]);
  const view = await openStep();

  await act(async () => { fireEvent.press(view.getByText(t.onboarding.calendarSync.apple)); });
  await new Promise((resolve) => setTimeout(resolve, 700));
  expect(view.getByText('Work')).toBeTruthy();
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(view.queryByTestId('onboarding-calendar-connected')).toBeNull();

  await act(async () => { fireEvent.press(view.getByText('Work')); });
  expect(view.getByTestId('onboarding-calendar-connected')).toBeTruthy();
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('Notifications'), { timeout: 1000 });
});

describe('come back with a calendar connected', () => {
  beforeEach(async () => {
    (getDeviceCalendars as jest.Mock).mockResolvedValue([HOME, WORK]);
    await AsyncStorage.setItem('calendar-sync-settings', JSON.stringify({
      exportEnabled: true,
      exportCalendarId: 'cal-1',
      lastExportTime: null,
      importEnabled: true,
      importCalendarIds: ['cal-1'],
      importInterval: 'always',
      lastImportTime: null,
    }));
    (AsyncStorage.setItem as jest.Mock).mockClear();
  });

  it('shows it ticked, with nothing to set up later', async () => {
    const view = await openStep('Home');
    await waitFor(() => view.getByTestId('onboarding-calendar-connected'));
    expect(view.queryByText(t.onboarding.calendarSync.setupLater)).toBeNull();
    expect(view.queryByTestId('onboarding-footer')).toBeNull();
  });

  it('goes on when it is tapped, without connecting it again', async () => {
    const view = await openStep('Home');
    await waitFor(() => view.getByTestId('onboarding-calendar-connected'));

    await act(async () => { fireEvent.press(view.getByText('Home')); });

    expect(navigation.navigate).toHaveBeenCalledWith('Notifications');
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('calendar-sync-settings', expect.anything());
  });

  it('connects another one tapped, and goes on', async () => {
    const view = await openStep('Work');
    await waitFor(() => view.getByTestId('onboarding-calendar-connected'));

    await act(async () => { fireEvent.press(view.getByText('Work')); });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('calendar-sync-settings', expect.stringContaining('"exportCalendarId":"cal-2"'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('Notifications'), { timeout: 1000 });
  });
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

// T-417: the access alert is typeset as the step's texts are: Alert.alert took
// the string as it was, a short word free to end a line.
it('typesets the access alert in the app\'s language (T-417)', async () => {
  mockLanguage.current = 'ru';
  const calendar = require('../../../../shared/services/calendar');
  calendar.checkCalendarPermissions.mockResolvedValueOnce(false);
  calendar.requestCalendarPermissions.mockResolvedValueOnce(false);
  const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => undefined);
  const ru = translations.ru;
  const kept = { title: ru.onboarding.calendarSync.permissionRequired, message: ru.calendarSync.permissionDeniedMessage };
  ru.onboarding.calendarSync.permissionRequired = 'Нужен доступ к календарю';
  ru.calendarSync.permissionDeniedMessage = 'Без него не выйдет → никак.';
  try {
    const view = await openStep(ru.onboarding.calendarSync.grantPermission);
    await act(async () => { fireEvent.press(view.getByText(ru.onboarding.calendarSync.grantPermission)); });
    expect(alert).toHaveBeenCalledWith(`Нужен доступ к${NBSP}календарю`, `Без него не${NBSP}выйдет${NBSP}→ никак.`);
  } finally {
    ru.onboarding.calendarSync.permissionRequired = kept.title;
    ru.calendarSync.permissionDeniedMessage = kept.message;
    alert.mockRestore();
  }
});

it('says it is setting the calendar up in the app\'s language', async () => {
  mockLanguage.current = 'de';
  const view = await openStep(translations.de.onboarding.calendarSync.apple);
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));

  await act(async () => { fireEvent.press(view.getByText(translations.de.onboarding.calendarSync.apple)); });

  expect(view.getByText('Kalendersynchronisation wird eingerichtet …')).toBeTruthy();
  expect(view.queryByText('Setting up calendar sync...')).toBeNull();
});
