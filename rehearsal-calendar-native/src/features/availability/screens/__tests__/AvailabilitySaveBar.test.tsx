/**
 * Save in the availability sheet sits above the home indicator (T-009).
 *
 * Its bar had a flat 12 pt under it, so on an iPhone 16 the button ran from
 * 799 to 840 pt: 22 of its 41 pt in the home-indicator zone (818-852), where
 * a finger reaching for it started the go-home gesture. Now the bar ends 8 pt
 * above the inset, and is there from the first day picked — off until
 * something changed — rather than appearing under the finger.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import AvailabilityScreen from '../AvailabilityScreen';

const INSETS = { top: 59, bottom: 34, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => INSETS,
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/hooks/useClock', () => ({ useToday: () => '2026-11-02' }));
jest.mock('../../../../shared/hooks/useAutoCalendarSync', () => ({
  useAutoCalendarSync: () => ({ performAutoSync: jest.fn(), forceSync: jest.fn() }),
}));
jest.mock('../../../../shared/components/PickerModal', () => ({ PickerModal: () => null }));
jest.mock('../../components', () => ({
  CalendarMonth: () => null,
  EditorHeader: () => null,
  ModeInfo: () => null,
}));

let mockHasChanges = false;
jest.mock('../../hooks', () => ({
  useAvailabilityData: () => ({
    availability: {},
    setAvailability: jest.fn(),
    loading: true,
    saving: false,
    setSaving: jest.fn(),
    hasChanges: mockHasChanges,
    changed: new Set(),
    markChanged: jest.fn(),
    markSaved: jest.fn(),
    markSettled: jest.fn(),
    getDayState: () => ({ mode: 'busy', slots: [] }),
    loadAvailability: jest.fn(),
    loadFailed: false,
  }),
  useAvailabilitySave: () => ({ saveAvailability: jest.fn() }),
  useAvailabilitySync: () => ({
    lastSyncTime: null,
    isSyncing: false,
    loadLastSyncTime: jest.fn(),
    formatLastSync: jest.fn(),
    performSmartSync: jest.fn(),
    performForceSync: jest.fn(),
  }),
  useAvailabilityEditor: () => ({
    selectedDates: ['2026-11-03'],
    selectedDate: '2026-11-03',
    panelOpen: true,
    panelAnimation: { interpolate: () => 0 },
    flatListRef: { current: null },
    validationError: null,
    handleDayPress: jest.fn(),
    handleModeChange: jest.fn(),
    clearSelection: jest.fn(),
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

function flat(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flat));
  return style as Record<string, unknown>;
}

function saveBar() {
  const screen = render(<AvailabilityScreen navigation={navigation} />);
  const save = screen.getByTestId('availability-save');
  // The first view around the button is its bar.
  let bar = save.parent;
  while (bar && bar.type !== 'View') bar = bar.parent;
  return { save, bar: flat(bar!.props.style) };
}

afterEach(() => {
  mockHasChanges = false;
});

it('the bar under Save ends 8 pt above the home indicator', () => {
  mockHasChanges = true;
  const { bar } = saveBar();

  expect(bar.paddingBottom).toBe(INSETS.bottom + 8);
});

it('with a day picked and nothing changed, Save is there and off', () => {
  const { save, bar } = saveBar();

  expect(save.props.disabled).toBe(true);
  expect(bar.paddingBottom).toBe(INSETS.bottom + 8);
});

it('once something changed, Save is on', () => {
  mockHasChanges = true;
  const { save } = saveBar();

  expect(save.props.disabled).toBe(false);
});
