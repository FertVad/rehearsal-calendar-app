/**
 * An invitation turned down stays turned down after signing out and in
 * (T-003 review, e2e/flows/43-invite-cold-start-close).
 *
 * Each stage has a container of its own, so the app's is mounted afresh at
 * every sign-in, and a fresh container with linking builds its first state from
 * the link the app was launched by. The system keeps handing out that link for
 * as long as the app runs, so after Cancel, signing out and signing in, the
 * invitation opened again. Here the app stage is mounted the way its container
 * mounts it — React Navigation's own useLinking and useThenable — with the
 * system's launch link stubbed.
 */
import React, { useRef } from 'react';
import { render, waitFor } from '@testing-library/react-native';
// @ts-expect-error — mapped by jest.config.js to the source React Navigation ships
import { useLinking } from '@react-navigation/native/useLinking';
// @ts-expect-error — the same
import { useThenable } from '@react-navigation/native/useThenable';
import { CommonActions, StackRouter } from '@react-navigation/routers';
import { linking } from '../linking';

jest.mock('expo-linking', () => ({ createURL: () => 'rehearsalapp://' }));

// The app was launched by an invitation; the system answers with it every time.
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Linking: {
    getInitialURL: jest.fn(async () => 'rehearsalapp://invite/ABCD2345'),
    addEventListener: jest.fn(() => ({ remove: () => {} })),
  },
}));

jest.mock('@react-navigation/core', () => ({
  getStateFromPath: jest.requireActual('@react-navigation/core/getStateFromPath').getStateFromPath,
  getActionFromState: jest.fn(),
  useNavigationIndependentTree: () => false,
}));

const routeNames = ['MainTabs', 'JoinProject', 'MarkBusy', 'CreateProject', 'AddRehearsal', 'Notifications', 'RehearsalDetails'];
const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
const router = StackRouter({});

// What the app stack's container starts with once it has read its link.
let firstState: ReturnType<typeof router.getRehydratedState> | null = null;

function AppStageContainer() {
  const ref = useRef(null);
  const { getInitialState } = useLinking(ref, linking, () => {});
  const [resolved, partial] = useThenable(getInitialState);
  if (resolved && !firstState) {
    firstState = partial
      ? router.getRehydratedState(partial as never, options)
      : router.getInitialState(options);
  }
  return null;
}

function Root({ stage }: { stage: 'auth' | 'app' }) {
  return stage === 'app' ? <AppStageContainer /> : null;
}

const screens = () => firstState!.routes.map((route) => route.name);

it('opens the launch link once — signing out and in again lands on the calendar', async () => {
  // Launched by the invitation, signed out: then signed in.
  const { rerender } = render(<Root stage="auth" />);
  rerender(<Root stage="app" />);
  await waitFor(() => expect(firstState).not.toBeNull());
  expect(screens()).toEqual(['MainTabs', 'JoinProject']);

  // Cancel goes back to the calendar.
  const cancelled = router.getStateForAction(firstState!, CommonActions.goBack(), options);
  expect(cancelled!.routes.map((route) => route.name)).toEqual(['MainTabs']);

  // Signed out, and in again — a new container for the app stage.
  rerender(<Root stage="auth" />);
  firstState = null;
  rerender(<Root stage="app" />);
  await waitFor(() => expect(firstState).not.toBeNull());
  expect(screens()).toEqual(['MainTabs']);
});
