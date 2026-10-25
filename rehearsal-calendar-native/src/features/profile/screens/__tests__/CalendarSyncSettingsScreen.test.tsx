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
jest.mock('../../../../shared/services/api', () => ({
  rehearsalsAPI: {
    getBatch: jest.fn().mockResolvedValue({
      data: { rehearsals: [{ id: 'r1', projectId: 'p1', projectName: 'Гамлет', startsAt: '', endsAt: '' }] },
    }),
  },
}));

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
    importNow: jest.fn().mockResolvedValue({ success: 2, failed: 0, skipped: 0, errors: [] }),
    syncAll: jest.fn().mockResolvedValue({ success: 1, failed: 0, errors: [] }),
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
  mockSync.syncAll.mockResolvedValue({ success: 0, failed: 2, errors: ['Гамлет: read-only'] });

  const [title, message] = await synchronize();

  expect(title).toBe(t.calendarSync.syncError);
  expect(message).toContain(t.calendarSync.exportIncomplete(2));
});

it('does not say "synced" when a calendar could not be read', async () => {
  mockSync.importNow.mockResolvedValue({ success: 2, failed: 1, skipped: 0, errors: ['1 calendar(s) could not be read'] });

  const [title, message] = await synchronize();

  expect(title).toBe(t.calendarSync.syncError);
  expect(message).toContain(t.calendarSync.importIncomplete(1));
});

it('still exports when the import fails', async () => {
  mockSync.importNow.mockRejectedValue(new Error('Network Error'));

  const [title, message] = await synchronize();

  expect(mockSync.syncAll).toHaveBeenCalled();
  expect(title).toBe(t.calendarSync.syncError);
  expect(message).toContain('Network Error');
});
