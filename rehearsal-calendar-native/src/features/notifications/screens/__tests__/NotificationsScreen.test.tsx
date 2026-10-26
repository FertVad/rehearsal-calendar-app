/**
 * A deleted notification stays deleted (cause fix 12: NI04).
 *
 * The inbox loads its list on focus and on pull. A load that read the list
 * before a deletion and answered after it put the deleted card back, and the
 * next tap on it found nothing on the server. Reads and changes now go in one
 * order (useRequestOrder): a load that answers while a deletion is on its way,
 * or that began before it landed, is dropped.
 */
import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';

const mockList = jest.fn();
jest.mock('../../../../shared/services/api', () => ({
  notificationsAPI: { list: (...args: any[]) => mockList(...args) },
}));
const mockRemove = jest.fn((_id: number) => Promise.resolve(true));
const mockMarkAllRead = jest.fn(() => Promise.resolve(true) as Promise<unknown>);
jest.mock('../../../../contexts/UnreadContext', () => ({
  useUnread: () => ({ unreadCount: 0, markRead: jest.fn(), markAllRead: mockMarkAllRead, remove: mockRemove, removeAll: jest.fn() }),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: jest.requireActual('../../../../i18n/translations').en }),
}));
// Each focus is a load the test starts itself.
const mockFocus: { run?: () => void } = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useFocusEffect: (effect: () => void) => { mockFocus.run = effect; },
}));
// The row's swipe action rendered in place, so its delete button can be pressed.
jest.mock('react-native-gesture-handler/Swipeable', () => {
  const { View } = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  return ({ children, renderRightActions }: any) => R.createElement(View, null, children, renderRightActions?.());
});
jest.mock('react-native-gesture-handler', () => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  return { TouchableOpacity };
});

const item = (id: number, title: string) => ({
  id, type: 'rehearsal_updated', title, body: 'Body', data: {}, relatedType: null, relatedId: null,
  read: true, createdAt: new Date().toISOString(),
});

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => mockList.mockReset());

it('does not bring back a card deleted while a load was out', async () => {
  mockList.mockResolvedValueOnce({ data: { notifications: [item(1, 'Act I moved'), item(2, 'Dress cancelled')] } });
  const screen = render(<NotificationsScreen />);
  await act(async () => { mockFocus.run?.(); });
  await waitFor(() => expect(screen.getByText('Dress cancelled')).toBeTruthy());

  // A pull reads the list; before it answers, the card is deleted.
  // The dropped read is made again (review), and finds the list after it.
  const stale = deferred();
  mockList
    .mockReturnValueOnce(stale.promise)
    .mockResolvedValueOnce({ data: { notifications: [item(1, 'Act I moved')] } });
  await act(async () => { mockFocus.run?.(); });
  const deletes = screen.getAllByLabelText('Delete');
  await act(async () => { deletes[1].props.onPress(); });
  expect(screen.queryByText('Dress cancelled')).toBeNull();

  await act(async () => { stale.resolve({ data: { notifications: [item(1, 'Act I moved'), item(2, 'Dress cancelled')] } }); });

  expect(mockList).toHaveBeenCalledTimes(3);
  expect(screen.queryByText('Dress cancelled')).toBeNull();
  expect(screen.getByText('Act I moved')).toBeTruthy();
});

// Every change takes its turn, not only a deletion (review): "Mark all read"
// succeeded, then a load asked for before it answered with the cards unread —
// the count at zero and the dots and the button back.
it('does not make cards unread again after "Mark all read" while a load was out', async () => {
  const unread = (id: number, title: string) => ({ ...item(id, title), read: false });
  mockList.mockResolvedValueOnce({ data: { notifications: [unread(1, 'Act I moved')] } });
  const screen = render(<NotificationsScreen />);
  await act(async () => { mockFocus.run?.(); });
  const markAll = await waitFor(() => screen.getByLabelText('Mark all read'));

  const stale = deferred();
  mockList
    .mockReturnValueOnce(stale.promise)
    .mockResolvedValueOnce({ data: { notifications: [item(1, 'Act I moved')] } });
  await act(async () => { mockFocus.run?.(); });
  await act(async () => { await markAll.props.onPress(); });
  expect(screen.queryByLabelText('Mark all read')).toBeNull();

  await act(async () => { stale.resolve({ data: { notifications: [unread(1, 'Act I moved')] } }); });

  expect(screen.queryByLabelText('Mark all read')).toBeNull();
});

// The whole time a change is on its way counts (review): a load asked for after
// the deletion was sent and answered before the server took it still holds the
// card, and nothing after the deletion's success took it out again.
it('does not bring back a card when a load answers while its deletion is on its way', async () => {
  mockList.mockResolvedValueOnce({ data: { notifications: [item(1, 'Act I moved'), item(2, 'Dress cancelled')] } });
  const screen = render(<NotificationsScreen />);
  await act(async () => { mockFocus.run?.(); });
  await waitFor(() => expect(screen.getByText('Dress cancelled')).toBeTruthy());

  const removing = deferred();
  mockRemove.mockReturnValueOnce(removing.promise as Promise<boolean>);
  const deletes = screen.getAllByLabelText('Delete');
  await act(async () => { deletes[1].props.onPress(); });

  mockList
    .mockResolvedValueOnce({ data: { notifications: [item(1, 'Act I moved'), item(2, 'Dress cancelled')] } })
    .mockResolvedValueOnce({ data: { notifications: [item(1, 'Act I moved')] } });
  await act(async () => { mockFocus.run?.(); });
  expect(screen.queryByText('Dress cancelled')).toBeNull();

  await act(async () => { removing.resolve(true); });

  expect(mockList).toHaveBeenCalledTimes(3);
  expect(screen.queryByText('Dress cancelled')).toBeNull();
  expect(screen.getByText('Act I moved')).toBeTruthy();
});

it('keeps cards read when a load answers while "Mark all read" is on its way', async () => {
  const unread = (id: number, title: string) => ({ ...item(id, title), read: false });
  mockList.mockResolvedValueOnce({ data: { notifications: [unread(1, 'Act I moved')] } });
  const screen = render(<NotificationsScreen />);
  await act(async () => { mockFocus.run?.(); });
  const markAll = await waitFor(() => screen.getByLabelText('Mark all read'));

  const marking = deferred();
  mockMarkAllRead.mockReturnValueOnce(marking.promise);
  let pressed!: Promise<void>;
  act(() => { pressed = markAll.props.onPress(); });

  mockList
    .mockResolvedValueOnce({ data: { notifications: [unread(1, 'Act I moved')] } })
    .mockResolvedValueOnce({ data: { notifications: [item(1, 'Act I moved')] } });
  await act(async () => { mockFocus.run?.(); });

  await act(async () => { marking.resolve(true); await pressed; });

  expect(screen.queryByLabelText('Mark all read')).toBeNull();
});
