/**
 * T-218 probe (not kept): does the close guard of a picked day see a "Busy"
 * made just before the tap on that day - at once, and with the screen's
 * reload (on focus) answering in between?
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ActionSheetIOS, Animated } from 'react-native';
import * as Navigation from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AvailabilityScreen from '../AvailabilityScreen';
import { availabilityAPI } from '../../../../shared/services/api';
import { setProfileTimezone } from '../../../../shared/utils/time';

const { __resetPreventRemove } = Navigation as unknown as { __resetPreventRemove: () => void };

jest.mock('../../../../shared/services/api');
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
  const { TouchableOpacity, View } = require('react-native');
  const React = require('react');
  return {
    CalendarMonth: ({ year, month, onDayPress }: { year: number; month: number; onDayPress: (y: number, m: number, d: number) => void }) =>
      year === 2026 && month === 10
        ? React.createElement(View, null, React.createElement(TouchableOpacity, { testID: 'day-8', onPress: () => onDayPress(2026, 10, 8) }))
        : null,
    EditorHeader: () => null,
    ModeInfo: () => null,
  };
});
jest.spyOn(Animated, 'spring').mockReturnValue({
  start: jest.fn(), stop: jest.fn(), reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);

const navigation = { canGoBack: () => true, goBack: jest.fn(), dispatch: jest.fn() } as any;
const showSheet = ActionSheetIOS.showActionSheetWithOptions as jest.Mock;
// 8 November, 23:00 to 01:00 the next day: the evening of flow 25.
const evening = { data: [{
  startsAt: '2026-11-08T23:00:00.000Z', endsAt: '2026-11-09T01:00:00.000Z', type: 'busy', isAllDay: false, source: 'manual',
}] };
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

beforeEach(async () => {
  jest.clearAllMocks();
  setProfileTimezone('UTC');
  await AsyncStorage.removeItem('availability-cache');
  __resetPreventRemove();
  (Navigation.useNavigation as jest.Mock).mockReturnValue(navigation);
  (Navigation.useFocusEffect as jest.Mock).mockImplementation((effect) => React.useEffect(effect, []));
});

it('Busy, then the day tapped at once: asks', async () => {
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue(evening);
  const screen = render(<AvailabilityScreen navigation={navigation} />);
  await settle(); await settle();
  fireEvent.press(screen.getByTestId('day-8'));
  fireEvent.press(screen.getByTestId('mode-busy'));
  fireEvent.press(screen.getByTestId('day-8'));
  expect(showSheet).toHaveBeenCalledTimes(1);
});

it('Busy, the reload answering after it, then the day: still busy, asks', async () => {
  let answer: (value: unknown) => void = () => {};
  (availabilityAPI.getAll as jest.Mock)
    .mockResolvedValueOnce(evening)
    .mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
  const screen = render(<AvailabilityScreen navigation={navigation} />);
  await settle(); await settle();
  expect(availabilityAPI.getAll).toHaveBeenCalledTimes(2);
  fireEvent.press(screen.getByTestId('day-8'));
  fireEvent.press(screen.getByTestId('mode-busy'));
  await act(async () => { answer(evening); });
  await settle();
  expect(screen.getByTestId('mode-busy').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByTestId('day-8'));
  expect(showSheet).toHaveBeenCalledTimes(1);
});
