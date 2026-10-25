/**
 * "Synchronize" is the sync, not a copy of it (cause fix 18).
 *
 * The button ran a sync of its own, beside the automatic one: its own reading
 * of the rehearsals, which dropped their titles (EO05), its own lock, which
 * the automatic run could not see, and the settings of the render it was
 * pressed in. Between its import and its export nothing was running as far
 * as the screen could tell, so Auto Sync could be switched off — and the old
 * handler exported to the calendar anyway (EO04). Settings were written as
 * whole objects from the screen's copy, so a stamp the sync had just written
 * went back to what the screen last saw.
 *
 * The screen, the hook and the storage are the real ones here; only the
 * device calendar and the server are not.
 */
import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, act, waitFor, renderHook } from '@testing-library/react-native';
import CalendarSyncSettingsScreen from '../CalendarSyncSettingsScreen';
import { useCalendarSync } from '../../../calendar/hooks/useCalendarSync';
import { getSyncSettings, updateLastImportTime } from '../../../../shared/utils/calendarStorage';
import { syncAllRehearsals } from '../../../../shared/services/calendar';
import { rehearsalsAPI } from '../../../../shared/services/api';
import { translations } from '../../../../i18n/translations';

const t = translations.en;

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');
  // The shared mock has no Switch; this one can be found and flipped.
  return { ...RN, Switch: (props: any) => React.createElement(RN.View, { testID: 'calendar-sync-toggle', ...props }) };
});
jest.mock('../../../../shared/services/calendar', () => ({
  checkCalendarPermissions: jest.fn().mockResolvedValue(true),
  requestCalendarPermissions: jest.fn().mockResolvedValue(true),
  getDeviceCalendars: jest.fn().mockResolvedValue([
    { id: 'cal-1', title: 'Home', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } },
    { id: 'cal-2', title: 'Work', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } },
  ]),
  getDefaultCalendar: jest.fn().mockResolvedValue(null),
  importCalendarEventsToAvailability: jest.fn().mockResolvedValue({ success: 0, failed: 0, skipped: 0, errors: [] }),
  syncAllRehearsals: jest.fn().mockResolvedValue({ success: 1, failed: 0, errors: [] }),
  removeAllExportedEvents: jest.fn(),
  removeAllImportedSlots: jest.fn(),
  syncRehearsalToCalendar: jest.fn(),
  unsyncRehearsal: jest.fn(),
}));
jest.mock('../../../../shared/utils/calendarMappings', () => ({ getAllMappings: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../../shared/services/api', () => ({
  projectsAPI: { getUserProjects: jest.fn().mockResolvedValue({ data: { projects: [{ id: 'p1' }] } }) },
  rehearsalsAPI: { getBatch: jest.fn() },
}));
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

const actTwo = {
  id: 'r1',
  projectId: 'p1',
  projectName: 'Village School',
  title: 'Act II',
  startsAt: '2026-11-02T16:00:00.000Z',
  endsAt: '2026-11-02T17:00:00.000Z',
  location: 'Main hall',
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('accessToken', 'a-token');
  await AsyncStorage.setItem('calendar-sync-settings', JSON.stringify({
    exportEnabled: true,
    exportCalendarId: 'cal-1',
    lastExportTime: null,
    importEnabled: true,
    importCalendarIds: ['cal-1'],
    importInterval: 'always',
    lastImportTime: null,
  }));
  (rehearsalsAPI.getBatch as jest.Mock).mockResolvedValue({ data: { rehearsals: [actTwo] } });
});

const openScreen = async () => {
  const view = render(<CalendarSyncSettingsScreen navigation={{ goBack: jest.fn() } as any} route={{} as any} />);
  await waitFor(() => view.getByText(t.calendarSync.synchronize));
  return view;
};

it('exports each rehearsal under its own title (EO05)', async () => {
  const view = await openScreen();

  await act(async () => { fireEvent.press(view.getByText(t.calendarSync.synchronize)); });
  await waitFor(() => expect(syncAllRehearsals).toHaveBeenCalled());

  const [rehearsals] = (syncAllRehearsals as jest.Mock).mock.calls[0];
  expect(rehearsals[0].title).toBe('Act II');
});

describe('Settings changed while a sync runs (EO04)', () => {
  let answer!: (value: unknown) => void;
  beforeEach(() => {
    (rehearsalsAPI.getBatch as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { answer = resolve; })
    );
  });

  it('cannot be changed until the whole run is over', async () => {
    const view = await openScreen();

    await act(async () => { fireEvent.press(view.getByText(t.calendarSync.synchronize)); });
    // The import is done; the export waits for the rehearsals.
    await waitFor(() => expect(rehearsalsAPI.getBatch).toHaveBeenCalled());

    expect(view.getByTestId('calendar-sync-toggle').props.disabled).toBe(true);

    await act(async () => { answer({ data: { rehearsals: [actTwo] } }); });
  });

  it('are not written past: sync turned off is not exported to', async () => {
    const view = await openScreen();

    await act(async () => { fireEvent.press(view.getByText(t.calendarSync.synchronize)); });
    await waitFor(() => expect(rehearsalsAPI.getBatch).toHaveBeenCalled());
    // Turned off while the run waits — whatever let it through.
    await act(async () => { fireEvent(view.getByTestId('calendar-sync-toggle'), 'valueChange', false); });
    await act(async () => { answer({ data: { rehearsals: [actTwo] } }); });
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());

    expect(syncAllRehearsals).not.toHaveBeenCalled();
    expect((await getSyncSettings()).exportEnabled).toBe(false);
  });
});

describe('A change of settings (EO04)', () => {
  it('keeps the stamp the sync wrote after the screen read its settings', async () => {
    const view = await openScreen();
    // The sync stamps "last import" itself, behind the screen's back.
    await updateLastImportTime();

    await act(async () => { fireEvent.press(view.getByText('Work')); });

    const stored = await getSyncSettings();
    expect(stored.exportCalendarId).toBe('cal-2');
    expect(stored.lastImportTime).not.toBeNull();
  });

  it('from the hook changes only what it names', async () => {
    const { result } = renderHook(() => useCalendarSync());
    await waitFor(() => expect(result.current.calendars).toHaveLength(2));
    await updateLastImportTime();

    await act(async () => { await result.current.updateSettings({ exportCalendarId: 'cal-2' }); });

    const stored = await getSyncSettings();
    expect(stored.exportCalendarId).toBe('cal-2');
    expect(stored.lastImportTime).not.toBeNull();
    expect(result.current.settings.lastImportTime).toBe(stored.lastImportTime);
  });
});
