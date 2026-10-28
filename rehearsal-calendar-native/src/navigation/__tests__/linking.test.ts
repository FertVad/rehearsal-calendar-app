/**
 * A screen a link opens can be closed (T-003 review, e2e/flows/43-invite-cold-start-close).
 *
 * Each stage has a container of its own, so the app stack's container is
 * mounted afresh once the person is signed in and past onboarding — and a fresh
 * container with linking builds its first state from the link the app was
 * launched by. That state held the invitation alone; its Cancel and Close call
 * goBack, which had nowhere to go. Here the state is built from the app's own
 * linking config by React Navigation's own parser and stack router.
 */
// @ts-expect-error — mapped by jest.config.js to the source React Navigation ships
import { getStateFromPath } from '@react-navigation/core/getStateFromPath';
import { CommonActions, StackRouter } from '@react-navigation/routers';
import { linking } from '../linking';

jest.mock('expo-linking', () => ({ createURL: () => 'rehearsalapp://' }));

const routeNames = ['MainTabs', 'JoinProject', 'MarkBusy', 'CreateProject', 'AddRehearsal', 'Notifications', 'RehearsalDetails'];

function launchedBy(path: string) {
  const router = StackRouter({});
  const partial = getStateFromPath(path, linking.config as never);
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const state = router.getRehydratedState(partial as never, options);
  return { state, back: () => router.getStateForAction(state, CommonActions.goBack(), options) };
}

it.each([
  ['invite/ABCD2345', 'JoinProject'],
  ['rehearsal/42', 'RehearsalDetails'],
])('opens %s over the calendar, and closing it goes back there', (path, screen) => {
  const { state, back } = launchedBy(path);

  expect(state.routes.map((route) => route.name)).toEqual(['MainTabs', screen]);
  expect(state.routes[state.index].name).toBe(screen);

  const after = back();
  expect(after).not.toBeNull();
  expect(after!.routes.map((route) => route.name)).toEqual(['MainTabs']);
});
