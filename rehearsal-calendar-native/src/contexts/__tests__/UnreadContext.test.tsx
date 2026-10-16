/**
 * The unread count.
 *
 * Four places used to keep their own answer, and the ways they disagreed are
 * what these tests pin: the badge must follow the count rather than being set
 * beside it, marking read must move the same number the bell reads, and a
 * failed request must not quietly report zero.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { UnreadProvider, useUnread } from '../UnreadContext';
import { changeOwner, resetSessionForTests } from '../../shared/services/session';

const mockUnreadCount = jest.fn();
const mockMarkRead = jest.fn();
const mockRemove = jest.fn();
const mockRemoveAll = jest.fn();
const mockSetBadge = jest.fn();

jest.mock('../../shared/services/api', () => ({
  notificationsAPI: {
    unreadCount: (...args: any[]) => mockUnreadCount(...args),
    markRead: (...args: any[]) => mockMarkRead(...args),
    remove: (...args: any[]) => mockRemove(...args),
    removeAll: (...args: any[]) => mockRemoveAll(...args),
  },
}));

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStorage[k] ?? null),
  setItem: (k: string, v: string) => {
    mockStorage[k] = v;
    return Promise.resolve();
  },
}));

jest.mock('expo-notifications', () => ({
  setBadgeCountAsync: (...args: any[]) => {
    mockSetBadge(...args);
    return Promise.resolve();
  },
}));

// Signed in unless a test says otherwise; the session moves through the real
// module, as the AuthContext moves it.
const mockAuth: { user: { id: number } | null } = { user: { id: 1 } };
jest.mock('../AuthContext', () => ({ useAuth: () => mockAuth }));

function Probe() {
  const { unreadCount, refresh, markRead, remove, removeAll } = useUnread();
  return (
    <>
      <Text testID="count">{String(unreadCount)}</Text>
      <TouchableOpacity testID="refresh" onPress={() => refresh()}>
        <Text>refresh</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="read-all" onPress={() => markRead()}>
        <Text>all</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="read-one" onPress={() => markRead([7])}>
        <Text>one</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="remove-one" onPress={() => remove(7)}>
        <Text>remove</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="remove-all" onPress={() => removeAll()}>
        <Text>remove all</Text>
      </TouchableOpacity>
    </>
  );
}

const renderProbe = () =>
  render(
    <UnreadProvider>
      <Probe />
    </UnreadProvider>
  );

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  mockUnreadCount.mockReset().mockResolvedValue({ data: { unreadCount: 3 } });
  mockMarkRead.mockReset().mockResolvedValue({ data: { unreadCount: 0 } });
  mockRemove.mockReset().mockResolvedValue({ data: { unreadCount: 2 } });
  mockRemoveAll.mockReset().mockResolvedValue({ data: { unreadCount: 0 } });
  mockSetBadge.mockReset();
  mockAuth.user = { id: 1 };
  resetSessionForTests();
});

function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

describe('Unread count', () => {
  it('starts at zero and asks nobody until told', () => {
    const { getByTestId } = renderProbe();
    expect(getByTestId('count').props.children).toBe('0');
    expect(mockUnreadCount).not.toHaveBeenCalled();
  });

  it('leaves the app icon alone until it knows a real number', async () => {
    // Writing the initial nought would clear the badge on every launch, before
    // the server has said anything — and with no network that is not a flicker
    // but the final answer.
    renderProbe();

    await act(async () => {});

    expect(mockSetBadge).not.toHaveBeenCalled();
  });

  it('comes back with the last count it knew, before asking anyone', async () => {
    mockStorage['unread-count:1'] = '5';

    const { getByTestId } = renderProbe();

    await waitFor(() => expect(getByTestId('count').props.children).toBe('5'));
  });

  it('shows the stored count when the server cannot be reached', async () => {
    // The case that matters: a launch with no network. Nought here would hide
    // notifications the reader has never seen.
    mockStorage['unread-count:1'] = '4';
    mockUnreadCount.mockRejectedValue(new Error('offline'));

    const { getByTestId } = renderProbe();
    await waitFor(() => expect(getByTestId('count').props.children).toBe('4'));

    await act(async () => {
      fireEvent.press(getByTestId('refresh'));
    });

    expect(getByTestId('count').props.children).toBe('4');
  });

  it('prefers the server to what it had stored', async () => {
    mockStorage['unread-count:1'] = '9';

    const { getByTestId } = renderProbe();
    fireEvent.press(getByTestId('refresh'));

    await waitFor(() => expect(getByTestId('count').props.children).toBe('3'));
  });

  it('takes the number the server reports', async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));

    await waitFor(() => expect(getByTestId('count').props.children).toBe('3'));
  });

  it('sets the app icon badge to the same number', async () => {
    // The badge follows the count rather than being set alongside it. Six call
    // sites used to set it, which is six chances to disagree with the bell.
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));

    await waitFor(() => expect(mockSetBadge).toHaveBeenCalledWith(3));
  });

  it('moves the count when the inbox is marked read', async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe('3'));

    fireEvent.press(getByTestId('read-all'));

    await waitFor(() => expect(getByTestId('count').props.children).toBe('0'));
    expect(mockMarkRead).toHaveBeenCalledWith(undefined);
  });

  it('marks one by id and takes what remains', async () => {
    mockMarkRead.mockResolvedValue({ data: { unreadCount: 2 } });
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('read-one'));

    await waitFor(() => expect(getByTestId('count').props.children).toBe('2'));
    expect(mockMarkRead).toHaveBeenCalledWith([7]);
  });

  it('keeps the last known count when the request fails', async () => {
    // Zeroing on a failed request would hide something the reader has not seen.
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe('3'));

    mockUnreadCount.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      fireEvent.press(getByTestId('refresh'));
    });

    expect(getByTestId('count').props.children).toBe('3');
  });

  it('lowers the count when an unread one is deleted', async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe('3'));

    fireEvent.press(getByTestId('remove-one'));

    await waitFor(() => expect(getByTestId('count').props.children).toBe('2'));
    expect(mockRemove).toHaveBeenCalledWith(7);
  });

  it('reports whether the deletion actually happened', async () => {
    // The screen removes the row before asking, so it needs to know when to put
    // it back.
    mockRemove.mockRejectedValueOnce(new Error('gone'));
    const { getByTestId } = renderProbe();

    await act(async () => {
      fireEvent.press(getByTestId('remove-one'));
    });

    expect(getByTestId('count').props.children).toBe('0');
  });

  it('empties the count when the inbox is cleared', async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe('3'));

    fireEvent.press(getByTestId('remove-all'));

    await waitFor(() => expect(getByTestId('count').props.children).toBe('0'));
  });

  it('survives a server answer with no number in it', async () => {
    mockUnreadCount.mockResolvedValue({ data: {} });
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));

    await waitFor(() => expect(getByTestId('count').props.children).toBe('0'));
  });
});

// The provider sits above the navigator, so a sign-out does not unmount it.
describe('Unread count across accounts (NI03)', () => {
  it('shows the next person none of the previous one\'s count', async () => {
    const { getByTestId } = renderProbe();
    fireEvent.press(getByTestId('refresh'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe('3'));

    mockAuth.user = { id: 2 };
    await act(async () => { await changeOwner(2); });

    expect(getByTestId('count').props.children).toBe('0');
  });

  it('writes nothing when the previous person\'s answer comes after the change', async () => {
    const late = held<any>();
    mockUnreadCount.mockReturnValueOnce(late.promise);
    const { getByTestId } = renderProbe();
    fireEvent.press(getByTestId('refresh'));

    mockAuth.user = { id: 2 };
    await act(async () => { await changeOwner(2); });
    mockSetBadge.mockReset();
    await act(async () => { late.resolve({ data: { unreadCount: 8 } }); });

    expect(getByTestId('count').props.children).toBe('0');
    expect(Object.values(mockStorage)).not.toContain('8');
    expect(mockSetBadge).not.toHaveBeenCalledWith(8);
  });

  // The order of reads and changes is the session's (review 3): a "Read all"
  // of the previous person still on its way kept the next person's count at 0.
  it('shows the next person their count while the previous one\'s change is on its way', async () => {
    const marking = held<any>();
    mockMarkRead.mockReturnValueOnce(marking.promise);
    const { getByTestId } = renderProbe();
    fireEvent.press(getByTestId('read-all'));

    mockAuth.user = { id: 2 };
    await act(async () => { await changeOwner(2); });
    mockUnreadCount.mockResolvedValueOnce({ data: { unreadCount: 8 } });
    await act(async () => { fireEvent.press(getByTestId('refresh')); });
    expect(getByTestId('count').props.children).toBe('8');

    await act(async () => { marking.resolve({ data: { unreadCount: 0 } }); });
    expect(getByTestId('count').props.children).toBe('8');

    mockUnreadCount.mockResolvedValueOnce({ data: { unreadCount: 6 } });
    await act(async () => { fireEvent.press(getByTestId('refresh')); });
    expect(getByTestId('count').props.children).toBe('6');
  });
});

// A read of the count that started before a change and answers after it is
// the old count (NI04).
describe('Unread count and late answers (NI04)', () => {
  it('keeps the count of a mark-all that finished after a slower read began', async () => {
    const slow = held<any>();
    mockUnreadCount.mockReturnValueOnce(slow.promise);
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));
    fireEvent.press(getByTestId('read-all'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe('0'));

    await act(async () => { slow.resolve({ data: { unreadCount: 5 } }); });

    expect(getByTestId('count').props.children).toBe('0');
    expect(mockStorage['unread-count:1']).toBe('0');
  });

  // The whole time a change is on its way counts (review): a push or the app
  // coming forward asks for the count after "Read all" was sent; its old 5
  // answered first and the 0 of "Read all" was then dropped as older.
  it('keeps the count of a mark-all when a read answers while it is on its way', async () => {
    const marking = held<any>();
    mockMarkRead.mockReturnValueOnce(marking.promise);
    mockUnreadCount.mockResolvedValueOnce({ data: { unreadCount: 5 } });
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('read-all'));
    await act(async () => { fireEvent.press(getByTestId('refresh')); });
    await act(async () => { marking.resolve({ data: { unreadCount: 0 } }); });

    expect(getByTestId('count').props.children).toBe('0');
    expect(mockStorage['unread-count:1']).toBe('0');
  });

  it('takes the answer of the change sent last, whichever answers first', async () => {
    const one = held<any>();
    const all = held<any>();
    mockRemove.mockReturnValueOnce(one.promise);
    mockMarkRead.mockReturnValueOnce(all.promise);
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('remove-one'));
    fireEvent.press(getByTestId('read-all'));
    await act(async () => { all.resolve({ data: { unreadCount: 0 } }); });
    await act(async () => { one.resolve({ data: { unreadCount: 4 } }); });

    expect(getByTestId('count').props.children).toBe('0');
  });
});
