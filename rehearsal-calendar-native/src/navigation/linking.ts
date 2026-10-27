import { Platform } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import type { AppStackParamList } from './types';

const prefix = Linking.createURL('/');

const localhostPrefix = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001'
  : 'http://localhost:3001';

export const linking: LinkingOptions<AppStackParamList> = {
  prefixes: [
    prefix,
    'rehearsalapp://',
    'https://rehearsly.me',
    // Kept so links handed out before the domain move still resolve
    'https://server-fertvads-projects.vercel.app',
    localhostPrefix
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
