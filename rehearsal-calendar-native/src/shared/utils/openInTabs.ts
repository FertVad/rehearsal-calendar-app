import { StackActions } from '@react-navigation/native';

/**
 * Go to a screen inside the tab navigator, from anywhere — including from a
 * modal presented on top of it.
 *
 * Both halves of this are load-bearing, and each was learned the hard way:
 *
 * `navigate` alone put a *second* MainTabs above the modal it was called from
 * rather than returning to the one underneath. The notification inbox is itself
 * a modal, so tapping an item gave a calendar inside the modal, carrying its own
 * bell, opening another inbox, without end.
 *
 * `popTo` alone fixed that and broke the destination: POP_TO only writes params
 * onto the route. Forwarding `{ screen, params }` down into a nested navigator
 * is something NAVIGATE does and POP_TO does not, so the calendar came up with
 * no idea which rehearsal it had been asked to show.
 *
 * So: clear anything stacked above the tabs, then navigate. After popToTop the
 * tabs are the current route, which is what stops navigate from pushing a copy.
 */
export function openInTabs(navigation: any, payload: object) {
  const state = navigation.getState?.();

  // Only when something is actually on top — popToTop on an already-bare stack
  // is a wasted dispatch.
  if (state && typeof state.index === 'number' && state.index > 0) {
    navigation.dispatch(StackActions.popToTop());
  }

  navigation.navigate('MainTabs', payload);
}
