/**
 * However the selection of "Mark Busy" empties, the editor goes down with its
 * Save through the question of the screen's close (T-026).
 *
 * The last day picked, tapped again, put the editor away unasked (review 1).
 * "Delete Data" of the past days picked let go of the whole selection after it
 * went through: with a future day changed and picked too, the editor went
 * down and the change was left unsaved, unasked (review 2). Now only the
 * deleted days are let go of; should none be left picked, the editor goes down
 * as its arrow does.
 *
 * The real screen and its hooks, with only the API, navigation, contexts and
 * the calendar's drawing standing in: the calendar is a button per day, the
 * editor's header a count of the days picked and its arrow. Today is 2
 * November; 1 November is past, 3 November saved busy all day.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Animated } from 'react-native';
import * as Navigation from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AvailabilityScreen from '../AvailabilityScreen';
import { availabilityAPI } from '../../../../shared/services/api';
import { setProfileTimezone } from '../../../../shared/utils/time';

const { __resetPreventRemove } = Navigation as unknown as { __resetPreventRemove: () => void };
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
        ? React.createElement(View, null, [1, 3].map((day) =>
          React.createElement(TouchableOpacity, { key: day, testID: `day-${day}`, onPress: () => onDayPress(2026, 10, day) })))
        : null,
    EditorHeader: ({ selectedCount, onClear }: { selectedCount: number; onClear: () => void }) =>
      React.createElement(View, null,
        React.createElement(Text, { testID: 'picked' }, selectedCount),
        React.createElement(TouchableOpacity, { testID: 'collapse', onPress: onClear })),
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
/** "Delete Data", confirmed. */
const deletePast = async (screen: ReturnType<typeof render>) => {
  fireEvent.press(screen.getByText(t.availability.deleteData));
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  await act(async () => { buttons.find((b: { text: string }) => b.text === t.common.delete).onPress(); });
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

describe('Tapping the last day picked again', () => {
  it('with the day changed, it asks; Don\'t Save puts it back and collapses', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));

    fireEvent.press(screen.getByTestId('day-3'));
    expect(showSheet).toHaveBeenCalledTimes(1);
    expect(picked(screen)).toBe(1);

    await choose(t.common.dontSave);
    expect(picked(screen)).toBe(0);
    fireEvent.press(screen.getByTestId('day-3'));
    expect(shown(screen, 'busy')).toBe(true);
  });

  it('Save saves and collapses; the day is not picked back', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));

    fireEvent.press(screen.getByTestId('day-3'));
    await choose(t.common.save);

    expect(saveDays).toHaveBeenCalledTimes(1);
    expect(picked(screen)).toBe(0);
  });

  it('with nothing changed, it collapses at once', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));

    fireEvent.press(screen.getByTestId('day-3'));

    expect(showSheet).not.toHaveBeenCalled();
    expect(picked(screen)).toBe(0);
  });

  it('another day picked, the one let go of goes without asking', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));
    fireEvent.press(screen.getByTestId('day-1'));

    fireEvent.press(screen.getByTestId('day-3'));

    expect(showSheet).not.toHaveBeenCalled();
    expect(picked(screen)).toBe(1);
  });
});

describe('"Delete Data" of the past days picked', () => {
  it('a future day changed and picked stays picked, its Save with it, and nothing is asked', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));
    fireEvent.press(screen.getByTestId('day-1'));

    await deletePast(screen);

    expect(saveDays).toHaveBeenCalledWith([{ date: '2026-11-01', entries: [] }]);
    expect(picked(screen)).toBe(1);
    expect(shown(screen, 'free')).toBe(true);
    expect(screen.getByTestId('availability-save').props.accessibilityState?.disabled).toBeFalsy();
    expect(showSheet).not.toHaveBeenCalled();
  });

  it('none left picked with a day still unsaved: the editor goes down only once asked', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('mode-free'));
    fireEvent.press(screen.getByTestId('day-1'));
    // Let go of the changed day; the past one stays picked.
    fireEvent.press(screen.getByTestId('day-3'));

    await deletePast(screen);

    expect(showSheet).toHaveBeenCalledTimes(1);
    expect(picked(screen)).toBe(1);

    await choose(t.common.cancel);
    expect(picked(screen)).toBe(1);

    fireEvent.press(screen.getByTestId('collapse'));
    await choose(t.common.dontSave);
    expect(picked(screen)).toBe(0);
    fireEvent.press(screen.getByTestId('day-3'));
    expect(shown(screen, 'busy')).toBe(true);
  });

  it('none left picked and nothing unsaved but the deleted day: the editor goes down unasked', async () => {
    const screen = await open();
    fireEvent.press(screen.getByTestId('day-3'));
    fireEvent.press(screen.getByTestId('day-1'));
    // Both made free, then 3 November busy again, as saved: only 1 November,
    // which is about to be deleted, differs from the server.
    fireEvent.press(screen.getByTestId('mode-free'));
    fireEvent.press(screen.getByTestId('day-1'));
    fireEvent.press(screen.getByTestId('mode-busy'));
    fireEvent.press(screen.getByTestId('day-1'));
    fireEvent.press(screen.getByTestId('day-3'));
    expect(picked(screen)).toBe(1);

    await deletePast(screen);

    expect(showSheet).not.toHaveBeenCalled();
    expect(picked(screen)).toBe(0);
  });
});
