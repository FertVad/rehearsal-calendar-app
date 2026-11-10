import { Linking as NativeLinking } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import type { AppStackParamList } from './types';

const prefix = Linking.createURL('/');

// The link the app was launched by belongs to the launch, not to a container.
// Each stage has a container of its own, so the app's is mounted afresh at
// every sign-in, and each fresh one asked for the launch link again: an
// invitation turned down came back after signing out and in (T-003 review).
// The first container that can open it gets it; later ones get nothing. Links
// that arrive while the app runs come through the listener, as before.
let launchUrlTaken = false;

export const linking: LinkingOptions<AppStackParamList> = {
  getInitialURL() {
    if (launchUrlTaken) return null;
    launchUrlTaken = true;
    // React Navigation's own default: getInitialURL can fail to resolve on iOS
    // (facebook/react-native#25675), so it gives up after 150ms.
    return Promise.race([
      NativeLinking.getInitialURL(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 150)),
    ]);
  },
  // Only what opens the app. Universal links come from rehearsly.me alone
  // (app.json associatedDomains); the dev server hands out rehearsalapp://
  // links (server/routes/native/projectInvites.js), and e2e opens them so. The
  // server's address before the domain move and the dev server's own opened
  // nothing, and the old one showed in the bundle (T-242).
  prefixes: [
    prefix,
    'rehearsalapp://',
    'https://rehearsly.me',
  ],
  config: {
    // Whatever a link opens lies over the calendar. The app stack's container
    // builds its first state from the link the app was launched by, and without
    // this that state held the linked screen alone: an invitation's Cancel or
    // Close went back to nothing and stayed on screen (T-003 review).
    initialRouteName: 'MainTabs',
    screens: {
      MainTabs: {
        path: 'tabs',
        screens: {
          Calendar: 'calendar',
          Projects: 'projects',
          Planner: 'planner',
          Profile: 'profile',
        },
      },
      JoinProject: 'invite/:code',
      // What an exported calendar event points at. The event carries this URL
      // so a second device can tell which rehearsal it is — the id has to live
      // in a field iOS shows, since events have no hidden one, so it may as
      // well take the reader somewhere.
      RehearsalDetails: 'rehearsal/:rehearsalId',
    },
  },
};
