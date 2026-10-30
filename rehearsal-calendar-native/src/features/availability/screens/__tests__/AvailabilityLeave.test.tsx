/**
 * Closing "Mark Busy" with days changed and not saved asks first (T-013).
 *
 * The close button and the swipe down closed the sheet at once, and the days
 * changed in it were gone. Every way out removes the screen's route, so the
 * removal is what is held: the way out here is any removal, played by the
 * navigation mock's `__remove`.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import * as Navigation from '@react-navigation/native';
import AvailabilityScreen from '../AvailabilityScreen';

const { __remove, __resetPreventRemove } = Navigation as unknown as {
  __remove: (action?: object) => boolean;
  __resetPreventRemove: () => void;
};
const t = require('../../../../i18n/translations').translations.en;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
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
let mockCanSave = true;
const mockSave = jest.fn();
jest.mock('../../hooks', () => ({
  useAvailabilityData: () => ({
    availability: {},
    setAvailability: jest.fn(),
    loading: true,
    saving: false,
    setSaving: jest.fn(),
    hasChanges: mockHasChanges,
    changed: mockHasChanges ? { '2026-11-03': 1 } : {},
    markChanged: jest.fn(),
    markSaved: jest.fn(),
    markSettled: jest.fn(),
    getDayState: () => ({ mode: 'busy', slots: [] }),
    loadAvailability: jest.fn(),
    loadFailed: false,
  }),
  useAvailabilitySave: () => ({ saveAvailability: mockSave, canSave: () => mockCanSave }),
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

const navigation = { canGoBack: () => true, goBack: jest.fn(), dispatch: jest.fn() } as any;
const showSheet = ActionSheetIOS.showActionSheetWithOptions as jest.Mock;
const swipe = { type: 'POP', payload: { count: 1 } };

beforeEach(() => {
  jest.clearAllMocks();
  __resetPreventRemove();
  (Navigation.useNavigation as jest.Mock).mockReturnValue(navigation);
  mockHasChanges = false;
  mockCanSave = true;
});

/** The sheet's choice by its label, as a tap on it. */
const choose = async (label: string) => {
  const [{ options }, answer] = showSheet.mock.calls.at(-1);
  await act(async () => { await answer(options.indexOf(label)); });
};

it('with nothing changed, it closes at once', () => {
  render(<AvailabilityScreen navigation={navigation} />);

  expect(__remove()).toBe(true);
  expect(showSheet).not.toHaveBeenCalled();
});

it('with days changed, a way out asks: Don\'t Save, Save, Cancel', () => {
  mockHasChanges = true;
  render(<AvailabilityScreen navigation={navigation} />);

  expect(__remove(swipe)).toBe(false);
  expect(showSheet).toHaveBeenCalledTimes(1);
  expect(showSheet.mock.calls[0][0]).toMatchObject({
    options: [t.common.dontSave, t.common.save, t.common.cancel],
    destructiveButtonIndex: 0,
    cancelButtonIndex: 2,
  });
});

it('Don\'t Save closes it the way it was being closed; Cancel keeps it open', async () => {
  mockHasChanges = true;
  render(<AvailabilityScreen navigation={navigation} />);

  __remove(swipe);
  await choose(t.common.cancel);
  expect(navigation.dispatch).not.toHaveBeenCalled();

  __remove(swipe);
  await choose(t.common.dontSave);
  expect(navigation.dispatch).toHaveBeenCalledWith(swipe);
  expect(mockSave).not.toHaveBeenCalled();
});

it('Save saves the days, without an alert over the closing sheet, and then closes it', async () => {
  mockHasChanges = true;
  mockSave.mockResolvedValue(true);
  render(<AvailabilityScreen navigation={navigation} />);

  __remove();
  await choose(t.common.save);

  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ announce: false }));
  expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
});

it('a save that fails leaves the sheet open', async () => {
  mockHasChanges = true;
  mockSave.mockResolvedValue(false);
  render(<AvailabilityScreen navigation={navigation} />);

  __remove();
  await choose(t.common.save);

  expect(mockSave).toHaveBeenCalled();
  expect(navigation.dispatch).not.toHaveBeenCalled();
});

it('changes that cannot be saved as they are offer no Save', () => {
  mockHasChanges = true;
  mockCanSave = false;
  render(<AvailabilityScreen navigation={navigation} />);

  __remove();

  expect(showSheet.mock.calls[0][0]).toMatchObject({
    options: [t.common.dontSave, t.common.cancel],
    cancelButtonIndex: 1,
  });
});
