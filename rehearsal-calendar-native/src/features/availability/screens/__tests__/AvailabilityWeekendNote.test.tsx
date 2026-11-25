/**
 * The weekend's hint in the editor is a footnote to the mode buttons (T-411).
 *
 * It had 20 pt of its own on each side, so it was narrower than the buttons
 * and the "You're busy this day" plate, and nothing under it: its last line
 * sat on the plate, 20 pt away from the buttons it explains. Now its edges are
 * the buttons' (the sheet's padding, nothing of its own), it is closer to the
 * buttons than to what follows, and the rhythm is in margins, none negative.
 * A working day's editor and the "From calendar" note are as they were.
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
jest.mock('../../../../shared/hooks/useClock', () => ({ useToday: () => '2026-11-02' }));
jest.mock('../../../../shared/hooks/useReviewAfterSave', () => ({ useReviewAfterSave: () => () => undefined }));
jest.mock('../../../../shared/hooks/useAutoCalendarSync', () => ({
  useAutoCalendarSync: () => ({ performAutoSync: jest.fn(), forceSync: jest.fn() }),
}));
jest.mock('../../../../shared/components/PickerModal', () => ({ PickerModal: () => null }));
jest.mock('../../components', () => {
  const { View } = require('react-native');
  return {
    CalendarMonth: () => null,
    EditorHeader: () => null,
    ModeInfo: () => <View testID="mode-info" />,
  };
});

const IMPORTED = [{ start: '10:00', end: '11:00', source: 'device_calendar', isAllDay: false }];
let mockDay: Record<string, unknown> = { mode: 'busy', slots: [] };
jest.mock('../../hooks', () => ({
  useAvailabilityData: () => ({
    availability: {},
    setAvailability: jest.fn(),
    loading: false,
    saving: false,
    setSaving: jest.fn(),
    hasChanges: false,
    changed: new Set(),
    markChanged: jest.fn(),
    markSaved: jest.fn(),
    markSettled: jest.fn(),
    getDayState: () => mockDay,
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
    selectedDates: ['2026-11-07'],
    selectedDate: '2026-11-07',
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

function flat(style: unknown): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flat));
  return style as Record<string, any>;
}

const HORIZONTAL = ['margin', 'marginHorizontal', 'marginLeft', 'marginRight', 'marginStart', 'marginEnd',
  'padding', 'paddingHorizontal', 'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd'];
const VERTICAL = ['margin', 'marginVertical', 'marginTop', 'marginBottom'];

function editor() {
  const screen = render(<AvailabilityScreen navigation={navigation} />);
  const selector = flat(screen.getByTestId('mode-selector').props.style);
  const hint = screen.queryByTestId('availability-weekend-default');
  return { screen, selector, hint: hint ? flat(hint.props.style) : null };
}

afterEach(() => {
  mockDay = { mode: 'busy', slots: [] };
});

describe('a weekend busy by default', () => {
  beforeEach(() => {
    mockDay = { mode: 'busy', slots: [], weekendDefault: true };
  });

  it('the hint has no side margins or padding of its own: its edges are the buttons\'', () => {
    const { hint } = editor();

    for (const key of HORIZONTAL) expect(hint![key]).toBeUndefined();
  });

  it('the hint has room under it, at least as much as between the buttons and it', () => {
    const { selector, hint } = editor();

    expect(hint!.marginBottom).toBeGreaterThan(0);
    expect(hint!.marginBottom).toBeGreaterThanOrEqual(selector.marginBottom);
  });

  it('the hint is nearer the buttons it explains than what follows it', () => {
    const { selector, hint } = editor();

    expect(selector.marginBottom).toBeLessThan(hint!.marginBottom);
  });

  it('no margin around the hint is negative', () => {
    const { selector, hint } = editor();

    for (const key of VERTICAL) {
      if (hint![key] !== undefined) expect(hint![key]).toBeGreaterThanOrEqual(0);
    }
    expect(selector.marginBottom).toBeGreaterThanOrEqual(0);
  });

  it('with events from the calendar, the same room before their section', () => {
    mockDay = { mode: 'busy', slots: [], weekendDefault: true, importedSlots: IMPORTED };
    const { screen, selector, hint } = editor();

    expect(screen.getByText('Already Scheduled')).toBeTruthy();
    expect(hint!.marginBottom).toBeGreaterThanOrEqual(selector.marginBottom);
  });
});

describe('as before T-411', () => {
  it('a working day: no hint, 20 pt under the buttons', () => {
    const { selector, hint } = editor();

    expect(hint).toBeNull();
    expect(selector.marginBottom).toBe(20);
  });

  it('the "From calendar" note keeps its style, no margins of its own', () => {
    mockDay = { mode: 'busy', slots: [], importedSlots: IMPORTED };
    const { screen } = editor();
    const note = flat(screen.getByText(/Everyone else sees these hours/).props.style);

    expect(note).toEqual({ fontSize: expect.any(Number), color: expect.any(String), lineHeight: 16 });
  });
});
