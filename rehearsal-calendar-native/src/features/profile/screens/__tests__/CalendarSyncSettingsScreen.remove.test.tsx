/**
 * T-270: taking back what sync brought in and what it put out.
 *
 * The privacy policy promises a button that removes every busy time imported
 * from the phone's calendars; the logic was there (useCalendarSync's
 * clearImported, DELETE /availability/imported/all) and no screen called it.
 * "Remove Exported Rehearsals" was there only while Auto Sync was on, and did
 * not stay done: the export stayed on, and the next sync put everything back.
 * Clearing asked for calendar access it does not need — the rows are the
 * server's — so whoever took the access away could not remove them.
 *
 * Now both sit at the bottom of the screen whatever the switch says; the
 * imported one without calendar access too. Removing turns Auto Sync off, as
 * the switch does, and the question says so. And the screen says nothing in
 * English that is not in the translations.
 */
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import CalendarSyncSettingsScreen from '../CalendarSyncSettingsScreen';
import { translations } from '../../../../i18n/translations';

const mockLanguage = { current: 'en' as 'en' | 'ru' | 'es' | 'de' };
const mockSync: any = {};
jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), Switch: () => null }));
jest.mock('../../../calendar/hooks/useCalendarSync', () => ({ useCalendarSync: () => mockSync }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: require('../../../../i18n/translations').translations[mockLanguage.current],
    language: mockLanguage.current,
  }),
}));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading, testID }: any) => React.createElement(TouchableOpacity,
      { testID, onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
  };
});

const calendar = { id: 'cal-1', title: 'Home', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } };
const google = { id: 'cal-g', title: 'maya@gmail.com', allowsModifications: true, source: { name: 'Google', type: 'caldav' } };
const ON = { exportEnabled: true, exportCalendarId: 'cal-1', importEnabled: true, importCalendarIds: ['cal-1'], importInterval: 'always' };
const OFF = { exportEnabled: false, exportCalendarId: 'cal-1', importEnabled: false, importCalendarIds: [], importInterval: 'manual' };
const SYNC_OFF_PATCH = { exportEnabled: false, importEnabled: false, importCalendarIds: [], importInterval: 'manual' };

const t = () => translations[mockLanguage.current];
const alerts = () => (Alert.alert as jest.Mock).mock.calls;

beforeEach(() => {
  mockLanguage.current = 'en';
  (Alert.alert as jest.Mock).mockReset();
  Object.assign(mockSync, {
    hasPermission: true,
    calendars: [calendar],
    settings: { ...OFF, lastExportTime: null, lastImportTime: null },
    isSyncing: false,
    isImporting: false,
    syncedCount: 0,
    requestPermissions: jest.fn(),
    updateSettings: jest.fn().mockResolvedValue(undefined),
    removeAll: jest.fn().mockResolvedValue({ success: 2, failed: 0, errors: [] }),
    clearImported: jest.fn().mockResolvedValue({ success: 3, failed: 0, skipped: 0, errors: [] }),
    refresh: jest.fn(),
    synchronize: jest.fn(),
  });
});

const open = () => render(<CalendarSyncSettingsScreen navigation={{ goBack: jest.fn() } as any} route={{} as any} />);

/** Press the button, then the question's own button of the same name. */
const confirm = async (view: ReturnType<typeof open>, testID: string) => {
  await act(async () => { fireEvent.press(view.getByTestId(testID)); });
  const [, , buttons] = alerts().at(-1);
  const go = buttons.find((b: any) => b.style === 'destructive');
  await act(async () => { await go.onPress(); });
};

describe('the two buttons are there whatever the switch says', () => {
  it('both, with Auto Sync off', () => {
    const view = open();
    expect(view.getByTestId('calendar-sync-clear-imported')).toBeTruthy();
    expect(view.getByTestId('calendar-sync-remove-all')).toBeTruthy();
    expect(view.getByText(t().calendarSync.clearImported)).toBeTruthy();
    expect(view.getByText(t().calendarSync.removeAll)).toBeTruthy();
  });

  it('both, with Auto Sync on', () => {
    mockSync.settings = { ...ON, lastExportTime: null, lastImportTime: null };
    const view = open();
    expect(view.getByTestId('calendar-sync-clear-imported')).toBeTruthy();
    expect(view.getByTestId('calendar-sync-remove-all')).toBeTruthy();
  });

  it('the imported one without calendar access, the exported one not', () => {
    mockSync.hasPermission = false;
    mockSync.calendars = [];
    const view = open();
    expect(view.getByTestId('calendar-sync-clear-imported')).toBeTruthy();
    expect(view.queryByTestId('calendar-sync-remove-all')).toBeNull();
  });
});

describe('removing what was imported', () => {
  it('asks first, and removes nothing on Cancel', async () => {
    const view = open();
    await act(async () => { fireEvent.press(view.getByTestId('calendar-sync-clear-imported')); });

    const [title, message, buttons] = alerts().at(-1);
    expect(title).toBe(t().calendarSync.clearImportedConfirm);
    expect(message).toBe(t().calendarSync.clearImportedMessage);
    expect(buttons.map((b: any) => b.text)).toEqual([t().common.cancel, t().calendarSync.clearImported]);
    await act(async () => { buttons[0].onPress?.(); });
    expect(mockSync.clearImported).not.toHaveBeenCalled();
  });

  it('calls clearImported once confirmed, and says it is done', async () => {
    const view = open();
    await confirm(view, 'calendar-sync-clear-imported');

    expect(mockSync.clearImported).toHaveBeenCalledTimes(1);
    expect(alerts().at(-1)[0]).toBe(t().calendarSync.clearImportedSuccess);
    // The count is not shown.
    expect(alerts().at(-1)[1]).toBe('');
    // Off already: nothing to turn off.
    expect(mockSync.updateSettings).not.toHaveBeenCalled();
  });

  it('without calendar access too', async () => {
    mockSync.hasPermission = false;
    mockSync.calendars = [];
    const view = open();
    await confirm(view, 'calendar-sync-clear-imported');

    expect(mockSync.clearImported).toHaveBeenCalledTimes(1);
    expect(alerts().at(-1)[0]).toBe(t().calendarSync.clearImportedSuccess);
  });

  it('with Auto Sync on, says it turns off, and turns it off before removing', async () => {
    mockSync.settings = { ...ON, lastExportTime: null, lastImportTime: null };
    const order: string[] = [];
    mockSync.updateSettings.mockImplementation(async () => { order.push('off'); });
    mockSync.clearImported.mockImplementation(async () => { order.push('clear'); return { success: 1, failed: 0, skipped: 0, errors: [] }; });
    const view = open();
    await act(async () => { fireEvent.press(view.getByTestId('calendar-sync-clear-imported')); });
    expect(alerts().at(-1)[1]).toBe(`${t().calendarSync.clearImportedMessage}\n\n${t().calendarSync.autoSyncTurnsOff}`);

    const go = alerts().at(-1)[2].find((b: any) => b.style === 'destructive');
    await act(async () => { await go.onPress(); });

    expect(mockSync.updateSettings).toHaveBeenCalledWith(SYNC_OFF_PATCH);
    expect(order).toEqual(['off', 'clear']);
  });

  it('removes nothing when Auto Sync could not be turned off', async () => {
    mockSync.settings = { ...ON, lastExportTime: null, lastImportTime: null };
    mockSync.updateSettings.mockRejectedValue(new Error('disk full'));
    const view = open();
    await confirm(view, 'calendar-sync-clear-imported');

    expect(mockSync.clearImported).not.toHaveBeenCalled();
    expect(alerts().at(-1)[0]).toBe(t().common.error);
  });

  it('says it failed, in the app’s words', async () => {
    mockSync.clearImported.mockRejectedValue(new Error('socket hang up'));
    const view = open();
    await confirm(view, 'calendar-sync-clear-imported');

    const [title, message] = alerts().at(-1);
    expect(title).toBe(t().common.error);
    expect(message).not.toContain('socket');
  });
});

describe('removing what was exported', () => {
  it('with Auto Sync off, asks without a word of turning it off', async () => {
    const view = open();
    await confirm(view, 'calendar-sync-remove-all');

    expect(alerts()[0][0]).toBe(t().calendarSync.removeAllConfirm);
    expect(alerts()[0][1]).toBe('');
    expect(mockSync.removeAll).toHaveBeenCalledTimes(1);
    expect(mockSync.updateSettings).not.toHaveBeenCalled();
  });

  it('with Auto Sync on, says it turns off, and turns it off: the next sync would put it all back', async () => {
    mockSync.settings = { ...ON, lastExportTime: null, lastImportTime: null };
    const view = open();
    await confirm(view, 'calendar-sync-remove-all');

    expect(alerts()[0][1]).toBe(t().calendarSync.autoSyncTurnsOff);
    expect(mockSync.updateSettings).toHaveBeenCalledWith(SYNC_OFF_PATCH);
    expect(mockSync.removeAll).toHaveBeenCalledTimes(1);
    expect(alerts().at(-1)[0]).toBe(t().calendarSync.removeAllSuccess);
  });
});

describe('the screen speaks the app’s language', () => {
  it('asks for a calendar first in the translation when the switch is turned on without one', async () => {
    mockLanguage.current = 'ru';
    mockSync.calendars = [];
    const { UNSAFE_root } = open();
    const { Switch } = require('react-native');
    // The switch is a stub here; its handler is what the screen gives it.
    const toggle = UNSAFE_root.findAll((node: any) => node.type === Switch)[0];
    await act(async () => { await toggle.props.onValueChange(true); });

    expect(alerts().at(-1)).toEqual([t().calendarSync.selectCalendar, t().calendarSync.chooseProviderFirst]);
  });

  it('names the calendars as onboarding does', () => {
    mockLanguage.current = 'ru';
    mockSync.calendars = [calendar, google];
    const view = open();
    expect(view.getByText(t().onboarding.calendarSync.apple)).toBeTruthy();
    expect(view.getByText(t().onboarding.calendarSync.google)).toBeTruthy();
    expect(view.queryByText('Apple Calendar')).toBeNull();
  });

  it('has no "Sync Now" when sync is off or no calendar of it is here, so it cannot be pressed then', () => {
    // Its handler's "Please enable sync and select a calendar first" could only
    // be reached from this button; it is gone with the branch.
    expect(open().queryByTestId('calendar-sync-run')).toBeNull();
    mockSync.settings = { ...ON, exportCalendarId: 'gone', lastExportTime: null, lastImportTime: null };
    expect(open().queryByTestId('calendar-sync-run')).toBeNull();
    mockSync.settings = { ...ON, lastExportTime: null, lastImportTime: null };
    expect(open().queryByTestId('calendar-sync-run')).toBeTruthy();
  });

  it('says the counts after a sync with nothing to export, not a sentence of its own', async () => {
    mockSync.settings = { ...ON, lastExportTime: null, lastImportTime: null };
    mockSync.synchronize.mockResolvedValue({
      import: { status: 'done', result: { success: 4, failed: 0, skipped: 0, errors: [] } },
      export: { status: 'done', result: { success: 0, failed: 0, errors: [], rehearsals: 0 } },
    });
    const view = open();
    await act(async () => { fireEvent.press(view.getByTestId('calendar-sync-run')); });

    expect(alerts().at(-1)).toEqual([
      t().calendarSync.syncSuccess,
      `${t().calendarSync.imported}: 4\n${t().calendarSync.exportedRehearsals}: 0`,
    ]);
  });

  it('has no English of its own in the code', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'CalendarSyncSettingsScreen.tsx'), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && !/logger\./.test(line))
      .join('\n');
    // A fallback after a translation: `t.x || 'Sync Error'`.
    expect(source.match(/\|\|\s*'[^']+'/g) ?? []).toEqual([]);
    // Words between tags: <Text>Apple Calendar</Text>.
    expect(source.match(/>[ \t]*[A-Za-z][^<>{}\n]*</g) ?? []).toEqual([]);
    // A sentence in quotes: 'Please select Google Calendar or Apple Calendar first'.
    expect(source.match(/'[A-Z][a-z]+(?: [A-Za-z!.?]+)+'/g) ?? []).toEqual([]);
  });
});
