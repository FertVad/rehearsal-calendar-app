/**
 * "Synchronize" says what happened (cause fix 17).
 *
 * The button ran the import and then the export in one try: an import that
 * threw skipped the export, and a run whose writes failed — counted, not
 * thrown — was announced under "Synced successfully" with the counts of what
 * did get through (EO02, EO06).
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import CalendarSyncSettingsScreen from '../CalendarSyncSettingsScreen';
import { translations } from '../../../../i18n/translations';

const t = translations.en;
const mockSync: any = {};
// The shared react-native mock has no Switch; this screen has one.
jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), Switch: () => null }));
jest.mock('../../../calendar/hooks/useCalendarSync', () => ({ useCalendarSync: () => mockSync }));
jest.mock('../../../../contexts/ProjectContext', () => ({ useProjects: () => ({ projects: [{ id: 'p1' }] }) }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading }: any) => React.createElement(TouchableOpacity,
      { onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
  };
});

// What the app's one sync reports of a run (services/calendarSync.ts).
const run = (
  imported: any = { status: 'done', result: { success: 2, failed: 0, skipped: 0, errors: [] } },
  exported: any = { status: 'done', result: { success: 1, failed: 0, errors: [], rehearsals: 1 } }
) => ({ import: imported, export: exported });

const calendar = { id: 'cal-1', title: 'Home', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } };

beforeEach(() => {
  (Alert.alert as jest.Mock).mockReset();
  Object.assign(mockSync, {
    hasPermission: true,
    calendars: [calendar],
    settings: {
      exportEnabled: true,
      exportCalendarId: 'cal-1',
      lastExportTime: null,
      importEnabled: true,
      importCalendarIds: ['cal-1'],
      importInterval: 'always',
      lastImportTime: null,
    },
    isSyncing: false,
    isImporting: false,
    syncedCount: 0,
    requestPermissions: jest.fn(),
    updateSettings: jest.fn(),
    removeAll: jest.fn(),
    refresh: jest.fn(),
    synchronize: jest.fn().mockResolvedValue(run()),
  });
});

const synchronize = async () => {
  const view = render(<CalendarSyncSettingsScreen navigation={{ goBack: jest.fn() } as any} route={{} as any} />);
  await act(async () => { fireEvent.press(view.getByText(t.calendarSync.synchronize)); });
  return (Alert.alert as jest.Mock).mock.calls.at(-1) as [string, string];
};

it('says "synced" when nothing failed', async () => {
  const [title] = await synchronize();

  expect(title).toBe(t.calendarSync.syncSuccess);
});

it('does not say "synced" when rehearsals could not be written', async () => {
  mockSync.synchronize.mockResolvedValue(run(undefined,
    { status: 'done', result: { success: 0, failed: 2, errors: ['Гамлет: read-only'], rehearsals: 2 } }));

  const [title, message] = await synchronize();

  expect(title).toBe(t.calendarSync.syncError);
  expect(message).toContain(t.calendarSync.exportIncomplete(2));
});

it('does not say "synced" when a calendar could not be read', async () => {
  mockSync.synchronize.mockResolvedValue(run(
    { status: 'done', result: { success: 2, failed: 1, skipped: 0, errors: ['1 calendar(s) could not be read'] } }));

  const [title, message] = await synchronize();

  expect(title).toBe(t.calendarSync.syncError);
  expect(message).toContain(t.calendarSync.importIncomplete(1));
});

it('names both when the import fails and the export runs', async () => {
  // That the export runs at all is the sync's (useAutoCalendarSync.test.ts,
  // "One direction failing"); the screen reports what each came to.
  mockSync.synchronize.mockResolvedValue(run({ status: 'failed', error: 'Network Error' }));

  const [title, message] = await synchronize();

  expect(title).toBe(t.calendarSync.syncError);
  expect(message).toContain('Network Error');
  expect(message).toContain(`${t.calendarSync.exportedRehearsals}: 1`);
});

it('says when the export could not run', async () => {
  mockSync.synchronize.mockResolvedValue(run(undefined, { status: 'failed', error: 'Request timed out' }));

  const [title, message] = await synchronize();

  expect(title).toBe(t.calendarSync.syncError);
  expect(message).toContain('Request timed out');
});
