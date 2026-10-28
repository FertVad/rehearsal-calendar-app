/**
 * Marking read says whether it happened (cause fix 21: NI02).
 *
 * A failed "read" was logged and fulfilled like a success, so the inbox showed
 * the cards read while the server — and the bell — still had them unread.
 * Every change now answers true or false, as a deletion already did.
 */
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { UnreadProvider, useUnread } from '../UnreadContext';
import { changeOwner, resetSessionForTests, SessionEndedError } from '../../shared/services/session';

const mockMarkRead = jest.fn();
jest.mock('../../shared/services/api', () => ({
  notificationsAPI: {
    unreadCount: jest.fn(() => Promise.resolve({ data: { unreadCount: 3 } })),
    markRead: (...args: any[]) => mockMarkRead(...args),
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
}));
jest.mock('expo-notifications', () => ({ setBadgeCountAsync: () => Promise.resolve() }));
jest.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));

const answers: unknown[] = [];

function Probe() {
  const { markRead } = useUnread();
  return (
    <TouchableOpacity testID="read-one" onPress={async () => { answers.push(await markRead([7])); }}>
      <Text>one</Text>
    </TouchableOpacity>
  );
}

beforeEach(() => {
  answers.length = 0;
  resetSessionForTests();
  mockMarkRead.mockReset();
});

it('answers false when the server did not take it, true when it did', async () => {
  mockMarkRead
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ data: { unreadCount: 2 } });
  const { getByTestId } = render(<UnreadProvider><Probe /></UnreadProvider>);

  await act(async () => { fireEvent.press(getByTestId('read-one')); });
  await act(async () => { fireEvent.press(getByTestId('read-one')); });

  expect(answers).toEqual([false, true]);
});

// The person who asked has signed out before the refusal came: the inbox's
// "Could not mark as read" went up over the next person's sign-in. A change of
// an ended session has nobody left to tell (review of cause fix 21).
it('does not answer false to the next person when the session that asked has ended', async () => {
  let refuse: (error: Error) => void = () => {};
  mockMarkRead.mockReturnValueOnce(new Promise((_, reject) => { refuse = reject; }));
  const { getByTestId } = render(<UnreadProvider><Probe /></UnreadProvider>);

  await act(async () => { fireEvent.press(getByTestId('read-one')); });
  await act(async () => {
    await changeOwner(2);
    refuse(new SessionEndedError());
  });

  expect(answers).toEqual([true]);
});
