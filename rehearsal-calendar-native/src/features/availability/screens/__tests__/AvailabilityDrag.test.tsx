/**
 * The editor of "Mark Busy" pulled down by its handle goes down as its arrow
 * puts it, never the screen (T-030).
 *
 * The handle had no drag of its own, so the swipe went to the MarkBusy modal
 * and closed the screen; "Save" of the close question saved and left. Now the
 * drag on the handle and the header is the editor's: far enough, or flicked,
 * it collapses through the guard; short of that it springs back.
 *
 * The real screen and its hooks, with only the API, navigation, contexts, the
 * calendar's drawing and gesture-handler standing in: the pan is its
 * callbacks, called here as the native side would. Today is 2 November;
 * 3 November is saved busy all day.
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
const { __gesture } = require('react-native-gesture-handler');
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
  const { Text, TouchableOpacity, View } = require('react-native');
  const React = require('react');
  return {
    CalendarMonth: ({ year, month, onDayPress }: { year: number; month: number; onDayPress: (y: number, m: number, d: number) => void }) =>
      year === 2026 && month === 10
        ? React.createElement(TouchableOpacity, { testID: 'day-3', onPress: () => onDayPress(2026, 10, 3) })
        : null,
    EditorHeader: ({ selectedCount }: { selectedCount: number }) =>
      React.createElement(View, null, React.createElement(Text, { testID: 'picked' }, selectedCount)),
    ModeInfo: () => null,
  };
});
const spring = jest.spyOn(Animated, 'spring').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);

const navigation = { canGoBack: () => true, goBack: jest.fn(), dispatch: jest.fn() } as any;
const showSheet = ActionSheetIOS.showActionSheetWithOptions as jest.Mock;
const saveDays = availabilityAPI.saveDays as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  setProfileTimezone('UTC');
  await AsyncStorage.removeItem('availability-cache');
  __resetPreventRemove();
  (Navigation.useNavigation as jest.Mock).mockReturnValue(navigation);
  (Navigation.useFocusEffect as jest.Mock).mockImplementation((effect) => React.useEffect(effect, []));
  (availabilityAPI.getAll as jest.Mock).mockResolvedValue({ data: [{
    startsAt: '2026-11-03T00:00:00.000Z', endsAt: '2026-11-03T23:59:59.999Z', type: 'busy', isAllDay: true, source: 'manual',
  }] });
  saveDays.mockResolvedValue({ data: {} });
});

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const open = async () => {
  const screen = render(<AvailabilityScreen navigation={navigation} />);
  await settle();
  await settle();
  return screen;
};
/** The finger on the handle, down by `translationY`, let go at `velocityY`. */
const pull = async (translationY: number, velocityY = 0) => {
  const { handlers } = __gesture('availability-sheet-drag');
  await act(async () => {
    handlers.onUpdate({ translationY, velocityY });
    handlers.onEnd({ translationY, velocityY }, true);
  });
  await settle();
};
const choose = async (label: string) => {
  const [{ options }, pick] = showSheet.mock.calls.at(-1);
  await act(async () => { pick(options.indexOf(label)); });
  await settle();
};
const picked = (screen: ReturnType<typeof render>) => screen.getByTestId('picked').props.children;
const shown = (screen: ReturnType<typeof render>, mode: string) =>
  screen.getByTestId(`mode-${mode}`).props.accessibilityState.selected;
const screenLeft = () => navigation.goBack.mock.calls.length + navigation.dispatch.mock.calls.length;

describe('The editor pulled down by its handle', () => {
  it('with nothing changed, collapses at once and the screen stays', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));

    await pull(150);

    expect(showSheet).not.toHaveBeenCalled();
    expect(picked(screen)).toBe(0);
    expect(screenLeft()).toBe(0);
  });

  it('with the day changed, asks; Save saves and collapses, the screen stays', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));

    await pull(150);
    expect(showSheet).toHaveBeenCalledTimes(1);
    expect(picked(screen)).toBe(1);

    await choose(t.common.save);
    expect(saveDays).toHaveBeenCalledTimes(1);
    expect(picked(screen)).toBe(0);
    expect(screenLeft()).toBe(0);
  });

  it('Don\'t Save puts the day back and collapses, the screen stays', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));

    await pull(150);
    await choose(t.common.dontSave);

    expect(saveDays).not.toHaveBeenCalled();
    expect(picked(screen)).toBe(0);
    expect(screenLeft()).toBe(0);
    fireEvent.press(screen.getByTestId('day-3'));
    expect(shown(screen, 'busy')).toBe(true);
  });

  it('Cancel leaves the editor as it was', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));

    await pull(150);
    await choose(t.common.cancel);

    expect(picked(screen)).toBe(1);
    expect(shown(screen, 'free')).toBe(true);
    expect(screenLeft()).toBe(0);
  });

  it('short of the distance, slowly, springs back and nothing goes', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));
    spring.mockClear();

    await pull(40, 200);

    expect(showSheet).not.toHaveBeenCalled();
    expect(picked(screen)).toBe(1);
    expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0 }));
  });

  it('a short flick down puts it away too', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));

    await pull(30, 1500);

    expect(picked(screen)).toBe(0);
  });
});
