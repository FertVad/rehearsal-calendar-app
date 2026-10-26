/**
 * The whole inbox, its errors, and a "read" the server did not take (cause fix
 * 21: NI01, NI02, NI05).
 *
 * The screen read only the newest fifty and offered nothing past them; with
 * those read and older ones not, "Mark all read" was hidden too. A failed load
 * showed "Nothing yet". A failed "read" was swallowed, and the cards were shown
 * read while the server still had them unread.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';

const mockList = jest.fn();
jest.mock('../../../../shared/services/api', () => ({
  notificationsAPI: { list: (...args: any[]) => mockList(...args) },
}));
const mockUnread = {
  unreadCount: 0,
  markRead: jest.fn((_ids: number[]) => Promise.resolve(true)),
  markAllRead: jest.fn(() => Promise.resolve(true)),
  remove: jest.fn(() => Promise.resolve(true)),
  removeAll: jest.fn(() => Promise.resolve(true)),
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
  return ({ children }: any) => R.createElement(View, null, children);
});
jest.mock('react-native-gesture-handler', () => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  return { TouchableOpacity };
});

// Newest first: id 60 a minute ago, id 1 an hour ago.
const item = (id: number, read = true) => ({
  id, type: 'rehearsal_updated', title: `Notice ${id}`, body: '', data: {}, relatedType: null, relatedId: null,
  read, createdAt: new Date(Date.now() - (61 - id) * 60_000).toISOString(),
});
const range = (from: number, to: number, read = true) => {
  const out = [];
  for (let id = from; id >= to; id--) out.push(item(id, read));
  return out;
};
const page = (notifications: any[], nextCursor: string | null = null) =>
  ({ data: { notifications, unreadCount: 0, nextCursor } });

async function open() {
  const screen = render(<NotificationsScreen />);
  await act(async () => { mockFocus.run?.(); });
  return screen;
}

beforeEach(() => {
  mockList.mockReset();
  mockUnread.unreadCount = 0;
  mockUnread.markRead.mockReset().mockResolvedValue(true);
  mockUnread.markAllRead.mockReset().mockResolvedValue(true);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('older pages (NI01)', () => {
  it('reaches the notifications past the first page', async () => {
    mockList
      .mockResolvedValueOnce(page(range(60, 11), 'c-11'))
      .mockResolvedValueOnce(page(range(10, 1)));
    const screen = await open();
    await waitFor(() => expect(screen.getByText('Notice 60')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByTestId('inbox-more')); });

    expect(mockList).toHaveBeenLastCalledWith('c-11');
    expect(screen.getByText('Notice 1')).toBeTruthy();
    expect(screen.queryByTestId('inbox-more')).toBeNull();
  });

  it('offers "Mark all read" while older ones are unread, though every card shown is read', async () => {
    mockUnread.unreadCount = 10;
    mockList.mockResolvedValueOnce(page(range(60, 11), 'c-11'));
    const screen = await open();
    await waitFor(() => expect(screen.getByText('Notice 60')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByLabelText('Mark all read')); });

    expect(mockUnread.markAllRead).toHaveBeenCalledTimes(1);
  });

  it('keeps the older pages when the newest is read again', async () => {
    mockList
      .mockResolvedValueOnce(page(range(60, 11), 'c-11'))
      .mockResolvedValueOnce(page(range(10, 1)))
      .mockResolvedValueOnce(page([item(61), ...range(60, 12)], 'c-12'));
    const screen = await open();
    await waitFor(() => expect(screen.getByText('Notice 60')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('inbox-more')); });

    // Back from a notification far down: the list is not cut to the first page.
    await act(async () => { mockFocus.run?.(); });

    expect(screen.getByText('Notice 61')).toBeTruthy();
    expect(screen.getByText('Notice 11')).toBeTruthy();
    expect(screen.getByText('Notice 1')).toBeTruthy();
    expect(screen.queryByTestId('inbox-more')).toBeNull();
  });

  // Review: sixty read, then fifty-one new. The newest page ends at 62, above
  // the cards shown; 61 was in neither, and with the old cursor gone it could
  // not be reached.
  it('reaches the ones between a newest page and the cards shown', async () => {
    const newer = (id: number) => ({ ...item(id, false), createdAt: new Date(Date.now() + id * 1000).toISOString() });
    const newerRange = (from: number, to: number) => {
      const out = [];
      for (let id = from; id >= to; id--) out.push(newer(id));
      return out;
    };
    mockList
      .mockResolvedValueOnce(page(range(60, 11), 'c-11'))
      .mockResolvedValueOnce(page(range(10, 1)))
      .mockResolvedValueOnce(page(newerRange(111, 62), 'c-62'))
      .mockResolvedValueOnce(page([newer(61), ...range(60, 12)], 'c-12'));
    const screen = await open();
    await waitFor(() => expect(screen.getByText('Notice 60')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('inbox-more')); });

    await act(async () => { mockFocus.run?.(); });
    await act(async () => { fireEvent.press(screen.getByTestId('inbox-more')); });

    expect(mockList).toHaveBeenLastCalledWith('c-62');
    expect(screen.getByText('Notice 111')).toBeTruthy();
    expect(screen.getByText('Notice 61')).toBeTruthy();
  });
});

describe('"Mark all read" before the list has come (review)', () => {
  it('shows the cards the server has, not "Nothing yet"', async () => {
    mockUnread.unreadCount = 1;
    let answer!: (value: unknown) => void;
    mockList
      .mockReturnValueOnce(new Promise((done) => { answer = done; }))
      .mockResolvedValueOnce(page([item(2)]));
    const screen = await open();

    await act(async () => { await screen.getByLabelText('Mark all read').props.onPress(); });
    await act(async () => { answer(page([item(2, false)])); });

    await waitFor(() => expect(screen.getByText('Notice 2')).toBeTruthy());
    expect(screen.queryByText('Nothing yet')).toBeNull();
  });
});

describe('a load that fails (NI05)', () => {
  it('says it could not load, not that there is nothing', async () => {
    mockList.mockRejectedValueOnce(new Error('offline'));
    const screen = await open();

    expect(screen.getByText('Could not load notifications')).toBeTruthy();
    expect(screen.queryByText('Nothing yet')).toBeNull();

    mockList.mockResolvedValueOnce(page([item(3)]));
    await act(async () => { fireEvent.press(screen.getByTestId('inbox-retry')); });

    expect(screen.getByText('Notice 3')).toBeTruthy();
    expect(screen.queryByText('Could not load notifications')).toBeNull();
  });

  it('keeps the cards it had, and says the refresh failed', async () => {
    mockList.mockResolvedValueOnce(page([item(3)]));
    const screen = await open();
    await waitFor(() => expect(screen.getByText('Notice 3')).toBeTruthy());

    mockList.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { mockFocus.run?.(); });

    expect(screen.getByText('Notice 3')).toBeTruthy();
    expect(screen.getByText('Could not load notifications')).toBeTruthy();
  });
});

describe('a "read" the server did not take (NI02)', () => {
  it('puts the cards back unread and says so when "Mark all read" fails', async () => {
    mockList.mockResolvedValueOnce(page([item(2, false), item(1, false)]));
    mockUnread.markAllRead.mockResolvedValueOnce(false);
    const screen = await open();
    const markAll = await waitFor(() => screen.getByLabelText('Mark all read'));

    await act(async () => { await markAll.props.onPress(); });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Could not mark as read');
    expect(screen.getByLabelText('Mark all read')).toBeTruthy();
  });

  it('puts the card back unread when opening it could not mark it read', async () => {
    mockList.mockResolvedValueOnce(page([item(2, false)]));
    let fail!: (ok: boolean) => void;
    mockUnread.markRead.mockReturnValueOnce(new Promise((done) => { fail = done; }));
    const screen = await open();
    await waitFor(() => expect(screen.getByLabelText('Mark all read')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByText('Notice 2')); });
    expect(screen.queryByLabelText('Mark all read')).toBeNull();

    await act(async () => { fail(false); });

    expect(mockUnread.markRead).toHaveBeenCalledWith([2]);
    expect(screen.getByLabelText('Mark all read')).toBeTruthy();
  });

  // Review: a card opened on a slow connection, then "Mark all read" that went
  // through. The first read failing late put the card back unread, though the
  // server had it read.
  it('does not take back a card a later "Mark all read" has read', async () => {
    mockList.mockResolvedValueOnce(page([item(2, false)]));
    let fail!: (ok: boolean) => void;
    mockUnread.markRead.mockReturnValueOnce(new Promise((done) => { fail = done; }));
    // The count has not heard of either read yet, so the button stays.
    mockUnread.unreadCount = 1;
    const screen = await open();
    await waitFor(() => expect(screen.getByLabelText('Mark all read')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByText('Notice 2')); });
    await act(async () => { await screen.getByLabelText('Mark all read').props.onPress(); });
    // "Mark all read" has answered: nothing unread on the server.
    mockUnread.unreadCount = 0;
    screen.rerender(<NotificationsScreen />);
    await act(async () => { fail(false); });

    expect(mockUnread.markAllRead).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Mark all read')).toBeNull();
  });

  it('takes it back when the later "Mark all read" failed too', async () => {
    mockList.mockResolvedValueOnce(page([item(2, false)]));
    let fail!: (ok: boolean) => void;
    mockUnread.markRead.mockReturnValueOnce(new Promise((done) => { fail = done; }));
    mockUnread.markAllRead.mockResolvedValueOnce(false);
    mockUnread.unreadCount = 1;
    const screen = await open();
    await waitFor(() => expect(screen.getByLabelText('Mark all read')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByText('Notice 2')); });
    await act(async () => { await screen.getByLabelText('Mark all read').props.onPress(); });
    // Only the card can bring the button back now.
    mockUnread.unreadCount = 0;
    screen.rerender(<NotificationsScreen />);
    expect(screen.queryByLabelText('Mark all read')).toBeNull();
    await act(async () => { fail(false); });

    expect(screen.getByLabelText('Mark all read')).toBeTruthy();
  });
});
