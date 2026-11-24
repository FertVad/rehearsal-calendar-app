/**
 * A day with no mark is drawn free on the month grid, from today on (T-292).
 *
 * The planner and the editor already took an unmarked day as free; only the
 * grid left it without a dot, so it read as "unknown" and people marked whole
 * weeks "Free" by hand to make them green (17 of 23 marks for one member, 7 of
 * 9 for another). Now green is "can", red "can't", yellow "partly". Days gone
 * by keep no dot: nobody plans them, and a green dot under each is noise.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import AvailabilityScreen from '../AvailabilityScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../hooks/useWeekStart', () => ({ useWeekStart: () => 'monday' }));
jest.mock('../../../../shared/hooks/useClock', () => ({ useToday: () => '2026-11-24' }));
jest.mock('../../../../shared/hooks/useAutoCalendarSync', () => ({
  useAutoCalendarSync: () => ({ performAutoSync: jest.fn(), forceSync: jest.fn() }),
}));
jest.mock('../../../../shared/components/PickerModal', () => ({ PickerModal: () => null }));

const event = { start: '19:00', end: '20:00', source: 'apple_calendar', isAllDay: false };

let mockAvailability: Record<string, unknown> = {};
let mockLoadFailed = false;
jest.mock('../../hooks', () => ({
  useAvailabilityData: () => ({
    availability: mockAvailability,
    setAvailability: jest.fn(),
    loading: false,
    setSaving: jest.fn(),
    hasChanges: false,
    differsFromSaved: () => false,
    changed: new Set(),
    markChanged: jest.fn(),
    markSaved: jest.fn(),
    markSettled: jest.fn(),
    discardChanges: jest.fn(),
    getDayState: () => ({ mode: 'free', slots: [] }),
    loadAvailability: jest.fn(),
    loadFailed: mockLoadFailed,
    loadError: null,
  }),
  useAvailabilitySave: () => ({ saveAvailability: jest.fn(), canSave: () => true, error: null, clearError: jest.fn() }),
  useAvailabilitySync: () => ({
    lastSyncTime: null,
    isSyncing: false,
    loadLastSyncTime: jest.fn(),
    formatLastSync: jest.fn(),
    performSmartSync: jest.fn(),
    performForceSync: jest.fn(),
  }),
  useAvailabilityEditor: () => ({
    selectedDates: [],
    selectedDate: null,
    panelOpen: false,
    panelAnimation: { interpolate: () => 0 },
    flatListRef: { current: null },
    validationError: null,
    handleDayPress: jest.fn(),
    handleModeChange: jest.fn(),
    clearSelection: jest.fn(),
    collapse: jest.fn(),
    deletePastDates: jest.fn(),
    openTimePicker: jest.fn(),
    closeTimePicker: jest.fn(),
    confirmTimePicker: jest.fn(),
    addSlot: jest.fn(),
    removeSlot: jest.fn(),
    showTimePicker: false,
    timePickerValue: new Date(),
    editingSlot: null,
  }),
}));

const navigation = { canGoBack: () => true, goBack: jest.fn() } as any;

const label = (date: string) => {
  const screen = render(<AvailabilityScreen navigation={navigation} />);
  return screen.getByTestId(`day-${date}`).props.accessibilityLabel;
};

afterEach(() => {
  mockAvailability = {};
  mockLoadFailed = false;
});

it('today and a day to come with no mark are free, the dot and the words', () => {
  expect(label('2026-11-24')).toBe('24, Free');
  expect(label('2026-11-27')).toBe('27, Free');
  expect(label('2026-12-03')).toBe('3, Free');
});

it('a day gone by with no mark keeps no dot', () => {
  expect(label('2026-11-23')).toBe('23');
  expect(label('2026-11-01')).toBe('1');
});

it('busy, partly and marked free stay what they were', () => {
  mockAvailability = {
    '2026-11-25': { mode: 'busy', slots: [], importedSlots: [] },
    '2026-11-26': { mode: 'custom', slots: [{ start: '10:00', end: '12:00' }], importedSlots: [] },
    '2026-11-27': { mode: 'free', slots: [], importedSlots: [] },
    // Not marked here, an event on it from the phone's calendar.
    '2026-11-28': { mode: 'custom', slots: [], importedSlots: [event] },
    '2026-11-20': { mode: 'busy', slots: [], importedSlots: [] },
  };

  expect(label('2026-11-25')).toBe('25, Busy');
  expect(label('2026-11-26')).toBe('26, Partial');
  expect(label('2026-11-27')).toBe('27, Free');
  expect(label('2026-11-28')).toBe('28, Partial');
  expect(label('2026-11-20')).toBe('20, Busy');
});

it('with nothing loaded at all, nothing is called free', () => {
  // The load failed and nothing was cached: an empty diary on screen is not
  // proof of an empty diary, so the grid does not paint one.
  mockLoadFailed = true;

  expect(label('2026-11-27')).toBe('27');
});
