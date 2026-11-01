/**
 * "Mark Busy" opens on this week and saves without an alert (T-021).
 *
 * It opened on the first of the month, so by its end the weeks gone filled
 * the top of the screen. A save went through with an alert to dismiss; its
 * reload put the spinner in the calendar's place, and the list came back at
 * its top. A failed save was an alert too. Now the list is scrolled once to
 * today's week as drawn, a save says "Saved" for two seconds with a haptic
 * and leaves the list where it was, and a failure is written above Save.
 *
 * The real screen and hooks; the API, navigation, contexts and the
 * calendar's drawing stand in. The calendar is a button for 3 November and,
 * in today's month, reports today's week 312 pt down.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert, Animated } from 'react-native';
import * as Navigation from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AvailabilityScreen from '../AvailabilityScreen';
import { availabilityAPI } from '../../../../shared/services/api';
import { setProfileTimezone } from '../../../../shared/utils/time';

const t = require('../../../../i18n/translations').translations.en;

const mockScrollToOffset = jest.fn();

jest.mock('../../../../shared/services/api');
// The month list, with the scrolling the screen asks of it.
jest.mock('react-native', () => {
  const native = jest.requireActual('../../../../__tests__/__mocks__/react-native.js');
  const ReactActual = jest.requireActual('react');
  native.Animated.FlatList = ReactActual.forwardRef((props: object, ref: unknown) => {
    ReactActual.useImperativeHandle(ref, () => ({ scrollToOffset: mockScrollToOffset }));
    return ReactActual.createElement(native.FlatList, props);
  });
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
    CalendarMonth: ({ year, month, onDayPress, onTodayLayout }: {
      year: number; month: number;
      onDayPress: (y: number, m: number, d: number) => void;
      onTodayLayout?: (y: number) => void;
    }) => {
      React.useEffect(() => { onTodayLayout?.(312); });
      return year === 2026 && month === 10
        ? React.createElement(TouchableOpacity, { testID: 'day-2026-11-03', onPress: () => onDayPress(2026, 10, 3) })
        : null;
    },
    EditorHeader: () => null,
    ModeInfo: () => null,
  };
});
jest.spyOn(Animated, 'spring').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);

const navigation = { canGoBack: () => true, goBack: jest.fn(), dispatch: jest.fn() } as any;
const getAll = availabilityAPI.getAll as jest.Mock;
const saveDays = availabilityAPI.saveDays as jest.Mock;
const loaded = { data: [{
  startsAt: '2026-11-03T00:00:00.000Z', endsAt: '2026-11-03T23:59:59.999Z', type: 'busy', isAllDay: true, source: 'manual',
}] };

beforeEach(async () => {
  jest.clearAllMocks();
  setProfileTimezone('UTC');
  await AsyncStorage.removeItem('availability-cache');
  (Navigation.useNavigation as jest.Mock).mockReturnValue(navigation);
  (Navigation.useFocusEffect as jest.Mock).mockImplementation((effect) => React.useEffect(effect, []));
  getAll.mockResolvedValue(loaded);
});

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const open = async () => {
  const screen = render(<AvailabilityScreen navigation={navigation} />);
  await settle();
  await settle();
  return screen;
};

it('opens on today\'s week as drawn, once', async () => {
  const screen = await open();

  expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 312, animated: false });

  // Picked and let go: the list is the person's now.
  fireEvent.press(screen.getByTestId('day-2026-11-03'));
  await settle();
  expect(mockScrollToOffset.mock.calls.filter(([{ offset }]) => offset === 312)).toHaveLength(1);
});

it('a save says "Saved" with a haptic, no alert, and the calendar stays while it is read back', async () => {
  const screen = await open();
  fireEvent.press(screen.getByTestId('day-2026-11-03'));
  fireEvent.press(screen.getByTestId('mode-free'));
  saveDays.mockResolvedValue({ data: {} });
  // The read after the save, still out.
  getAll.mockReturnValue(new Promise(() => {}));
  mockScrollToOffset.mockClear();
  const reads = getAll.mock.calls.length;

  fireEvent.press(screen.getByTestId('availability-save'));
  await settle();

  expect(saveDays).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(screen.getByTestId('toast').props.children).toBe(t.common.saved);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  // The calendar is not swapped for the spinner, so it is not back at its top.
  expect(getAll).toHaveBeenCalledTimes(reads + 1);
  expect(screen.queryByText(t.common.loading)).toBeNull();
  expect(screen.getByTestId('day-2026-11-03')).toBeTruthy();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it('a save that fails says why above Save, not in an alert, and keeps the day picked', async () => {
  const screen = await open();
  fireEvent.press(screen.getByTestId('day-2026-11-03'));
  fireEvent.press(screen.getByTestId('mode-free'));
  saveDays.mockRejectedValue(new Error('offline'));

  fireEvent.press(screen.getByTestId('availability-save'));
  await settle();

  expect(Alert.alert).not.toHaveBeenCalled();
  expect(screen.getByTestId('availability-save-error').props.children).toBe(t.availability.saveError);
  expect(screen.queryByTestId('toast')).toBeNull();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  expect(screen.getByTestId('mode-free').props.accessibilityState.selected).toBe(true);

  // Saved on the next try: the reason goes.
  saveDays.mockResolvedValue({ data: {} });
  fireEvent.press(screen.getByTestId('availability-save'));
  await settle();
  expect(screen.queryByTestId('availability-save-error')).toBeNull();
  expect(screen.getByTestId('toast')).toBeTruthy();
});
