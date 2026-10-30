/**
 * While a save of "Mark Busy" is out, the sheet is the one being saved
 * (T-013, review 2).
 *
 * The sheet stayed editable while its save was out: a day saved busy, made
 * free, saved from the close question, and made busy again meanwhile compared
 * with the server as unchanged — the sheet closed without asking and the save
 * wrote free. So these drive the real screen and its hooks, with only the API,
 * navigation, contexts and the calendar's drawing standing in: the calendar is
 * a button per day of the month shown.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Animated } from 'react-native';
import * as Navigation from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AvailabilityScreen from '../AvailabilityScreen';
import { availabilityAPI } from '../../../../shared/services/api';
import { setProfileTimezone } from '../../../../shared/utils/time';

const { __remove, __resetPreventRemove } = Navigation as unknown as {
  __remove: (action?: object) => boolean;
  __resetPreventRemove: () => void;
};
const t = require('../../../../i18n/translations').translations.en;

jest.mock('../../../../shared/services/api');
// The month list and its pull to refresh, which the shared mock leaves out.
jest.mock('react-native', () => {
  const native = jest.requireActual('../../../../__tests__/__mocks__/react-native.js');
  native.Animated.FlatList = native.FlatList;
  native.RefreshControl = () => null;
  return native;
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', timezone: 'UTC' }, isAuthenticated: true, loading: false }),
}));
jest.mock('../../../../shared/hooks/useClock', () => ({ useToday: () => '2026-11-02', useTimezone: () => 'UTC' }));
jest.mock('../../../../shared/hooks/useAutoCalendarSync', () => ({
  useAutoCalendarSync: () => ({ performAutoSync: jest.fn(), forceSync: jest.fn() }),
}));
jest.mock('../../../../shared/utils/calendarStorage', () => ({
  getSyncSettings: jest.fn(async () => ({ importEnabled: false, importCalendarIds: [] })),
}));
jest.mock('../../../../shared/components/PickerModal', () => ({ PickerModal: () => null }));
jest.mock('../../components', () => {
  const { TouchableOpacity } = require('react-native');
  const React = require('react');
  return {
    CalendarMonth: ({ year, month, onDayPress }: { year: number; month: number; onDayPress: (y: number, m: number, d: number) => void }) =>
      year === 2026 && month === 10
        ? React.createElement(TouchableOpacity, { testID: 'day-2026-11-03', onPress: () => onDayPress(2026, 10, 3) })
        : null,
    EditorHeader: () => null,
    ModeInfo: () => null,
  };
});
// The editor animates its panel; nothing here is about that.
jest.spyOn(Animated, 'spring').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);

const navigation = { canGoBack: () => true, goBack: jest.fn(), dispatch: jest.fn() } as any;
const showSheet = ActionSheetIOS.showActionSheetWithOptions as jest.Mock;
const saveDays = availabilityAPI.saveDays as jest.Mock;
const swipe = { type: 'POP', payload: { count: 1 } };

// The save request, answered when the test says.
let answer: () => void;
let fail: (error: Error) => void;

beforeEach(async () => {
  jest.clearAllMocks();
  setProfileTimezone('UTC');
  await AsyncStorage.removeItem('availability-cache');
  __resetPreventRemove();
  (Navigation.useNavigation as jest.Mock).mockReturnValue(navigation);
  // Focused once, on opening: the shared mock runs it on every render, and
  // the load it starts renders again.
  (Navigation.useFocusEffect as jest.Mock).mockImplementation((effect) => React.useEffect(effect, []));
  // Saved: busy all day on 3 November.
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [{
    startsAt: '2026-11-03T00:00:00.000Z', endsAt: '2026-11-03T23:59:59.999Z', type: 'busy', isAllDay: true, source: 'manual',
  }] });
  saveDays.mockImplementation(() => new Promise((resolve, reject) => {
    answer = () => resolve({ data: {} });
    fail = reject;
  }));
});

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const open = async () => {
  const screen = render(<AvailabilityScreen navigation={navigation} />);
  await settle();
  await settle();
  fireEvent.press(screen.getByTestId('day-2026-11-03'));
  return screen;
};
const choose = async (label: string) => {
  const [{ options }, pick] = showSheet.mock.calls.at(-1);
  await act(async () => { pick(options.indexOf(label)); });
};
const shown = (screen: ReturnType<typeof render>, mode: string) =>
  screen.getByTestId(`mode-${mode}`).props.accessibilityState.selected;
/** The day as the last save sent it. */
const sentMode = () => saveDays.mock.calls.at(-1)[0][0].entries;

it('the question\'s Save: the day cannot change meanwhile, the way out waits, and it closes once saved', async () => {
  const screen = await open();
  fireEvent.press(screen.getByTestId('mode-free'));
  __remove(swipe);
  await choose(t.common.save);

  // Changed back meanwhile — or it would close unasked and the save write free.
  fireEvent.press(screen.getByTestId('mode-busy'));
  expect(shown(screen, 'free')).toBe(true);
  expect(screen.getByTestId('availability-saving')).toBeTruthy();
  expect(__remove(swipe)).toBe(false);
  expect(showSheet).toHaveBeenCalledTimes(1);
  expect(navigation.dispatch).not.toHaveBeenCalled();

  await act(async () => { answer(); });
  await settle();

  expect(saveDays).toHaveBeenCalledTimes(1);
  expect(sentMode()).toEqual([expect.objectContaining({ type: 'available' })]);
  expect(navigation.dispatch).toHaveBeenCalledTimes(1);
  expect(navigation.dispatch).toHaveBeenCalledWith(swipe);
});

it('the editor\'s Save: the day cannot change meanwhile; saved, it is what was sent and nothing is left to lose', async () => {
  const screen = await open();
  fireEvent.press(screen.getByTestId('mode-free'));
  fireEvent.press(screen.getByTestId('availability-save'));
  await settle();

  fireEvent.press(screen.getByTestId('mode-busy'));
  expect(shown(screen, 'free')).toBe(true);
  expect(__remove()).toBe(false);
  expect(showSheet).not.toHaveBeenCalled();

  await act(async () => { answer(); });
  await settle();

  expect(sentMode()).toEqual([expect.objectContaining({ type: 'available' })]);
  expect(screen.queryByTestId('availability-saving')).toBeNull();
  expect(__remove()).toBe(true);
});

it('a save that fails keeps the day as changed, says so, and the sheet takes changes again', async () => {
  const screen = await open();
  fireEvent.press(screen.getByTestId('mode-free'));
  __remove(swipe);
  await choose(t.common.save);

  await act(async () => { fail(new Error('offline')); });
  await settle();

  expect(Alert.alert).toHaveBeenCalledWith(t.common.error, expect.anything());
  expect(navigation.dispatch).not.toHaveBeenCalled();
  expect(shown(screen, 'free')).toBe(true);
  expect(__remove(swipe)).toBe(false);
  expect(showSheet).toHaveBeenCalledTimes(2);

  fireEvent.press(screen.getByTestId('mode-custom'));
  expect(shown(screen, 'custom')).toBe(true);
});
