/**
 * The inbox says why a request failed, in the app's language (T-228, review 2).
 *
 * Its changes answered a bare false and its load kept `true`: the error was
 * gone before any window, and "Could not delete" stood for no connection and
 * for the server down alike. Each keeps the error now; what is taken back on
 * a failure is still taken back.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, act, fireEvent, waitFor } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';

const en = jest.requireActual('../../../../i18n/translations').en;

const mockList = jest.fn();
jest.mock('../../../../shared/services/api', () => ({
  notificationsAPI: { list: (...args: any[]) => mockList(...args) },
}));
const mockUnread = {
  unreadCount: 1,
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  remove: jest.fn(),
  removeAll: jest.fn(),
};
jest.mock('../../../../contexts/UnreadContext', () => ({ useUnread: () => mockUnread }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: jest.requireActual('../../../../i18n/translations').en }),
}));
const mockFocus: { run?: () => void } = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useFocusEffect: (effect: () => void) => { mockFocus.run = effect; },
}));
jest.mock('react-native-gesture-handler/Swipeable', () => {
  const { View } = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  return ({ children, renderRightActions }: any) => R.createElement(View, null, children, renderRightActions?.());
});
jest.mock('react-native-gesture-handler', () => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  return { TouchableOpacity };
});

// What axios rejects with: no answer at all, and the server down.
const offline = Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK', request: {} });
const serverDown = Object.assign(new Error('Request failed with status code 503'), {
  isAxiosError: true,
  response: { status: 503, data: {} },
});

const item = (id: number, title: string, read = false) => ({
  id, type: 'rehearsal_updated', title, body: 'Body', data: {}, relatedType: null, relatedId: null,
  read, createdAt: new Date().toISOString(),
});

let alert: jest.SpyInstance;
beforeEach(() => {
  mockList.mockReset();
  Object.values(mockUnread).forEach((f) => typeof f === 'function' && (f as jest.Mock).mockReset());
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());

async function opened(...items: ReturnType<typeof item>[]) {
  mockList.mockResolvedValueOnce({ data: { notifications: items } });
  const screen = render(<NotificationsScreen />);
  await act(async () => { mockFocus.run?.(); });
  await waitFor(() => expect(screen.getByText(items[0].title)).toBeTruthy());
  return screen;
}

describe.each([
  ['no connection', offline, en.common.noConnection],
  ['the server down', serverDown, en.common.serverUnavailable],
])('with %s', (_, error, said) => {
  it('a deletion says so, and the card comes back', async () => {
    const screen = await opened(item(1, 'Act I moved'));
    mockUnread.remove.mockResolvedValueOnce({ failed: error });

    await act(async () => { fireEvent.press(screen.getByLabelText(en.notifications.delete)); });

    expect(alert).toHaveBeenCalledWith(en.common.error, said);
    expect(screen.getByText('Act I moved')).toBeTruthy();
  });

  it('"Clear all" says so, and the inbox comes back', async () => {
    const screen = await opened(item(1, 'Act I moved'));
    mockUnread.removeAll.mockResolvedValueOnce({ failed: error });

    fireEvent.press(screen.getByLabelText(en.notifications.clearAll));
    const confirm = alert.mock.calls[0][2].find((b: any) => b.style === 'destructive');
    await act(async () => { await confirm.onPress(); });

    expect(alert).toHaveBeenLastCalledWith(en.common.error, said);
    expect(screen.getByText('Act I moved')).toBeTruthy();
  });

  it('"Mark all read" says so', async () => {
    const screen = await opened(item(1, 'Act I moved'));
    mockUnread.markAllRead.mockResolvedValueOnce({ failed: error });

    await act(async () => { fireEvent.press(screen.getByLabelText(en.notifications.markAllRead)); });

    expect(alert).toHaveBeenCalledWith(en.common.error, said);
  });

  it('a load that failed says so, with a retry', async () => {
    mockList.mockRejectedValueOnce(error);
    const screen = render(<NotificationsScreen />);
    await act(async () => { mockFocus.run?.(); });

    await waitFor(() => expect(screen.getByText(said)).toBeTruthy());
    expect(screen.getByTestId('inbox-retry')).toBeTruthy();
  });
});
