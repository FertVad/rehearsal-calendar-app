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

const mockUnreadCount = jest.fn();
const mockMarkRead = jest.fn();
const mockSetBadge = jest.fn();

jest.mock('../../shared/services/api', () => ({
  notificationsAPI: {
    unreadCount: (...args: any[]) => mockUnreadCount(...args),
    markRead: (...args: any[]) => mockMarkRead(...args),
  },
}));

jest.mock('expo-notifications', () => ({
  setBadgeCountAsync: (...args: any[]) => {
    mockSetBadge(...args);
    return Promise.resolve();
  },
}));

function Probe() {
  const { unreadCount, refresh, markRead } = useUnread();
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
  mockUnreadCount.mockReset().mockResolvedValue({ data: { unreadCount: 3 } });
  mockMarkRead.mockReset().mockResolvedValue({ data: { unreadCount: 0 } });
  mockSetBadge.mockReset();
});

describe('Unread count', () => {
  it('starts at zero and asks nobody until told', () => {
    const { getByTestId } = renderProbe();
    expect(getByTestId('count').props.children).toBe('0');
    expect(mockUnreadCount).not.toHaveBeenCalled();
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

  it('survives a server answer with no number in it', async () => {
    mockUnreadCount.mockResolvedValue({ data: {} });
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('refresh'));

    await waitFor(() => expect(getByTestId('count').props.children).toBe('0'));
  });
});
