import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Platform, View, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NavigationContainer, useNavigation, useNavigationContainerRef, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { Colors } from '../shared/constants/colors';
import { hapticLight, hapticMedium } from '../shared/utils/haptics';
import { inviteCodeFromUrl } from '../shared/utils/inviteCode';
import { CreateActionSheet } from '../shared/components/CreateActionSheet';
import { useNotifications } from '../shared/hooks/useNotifications';
import { BetaBanner } from '../shared/components/BetaBanner';
import { useAutoCalendarSync } from '../shared/hooks/useAutoCalendarSync';
import { OnboardingNavigator } from '../features/onboarding';
import JoinProjectScreen from '../features/projects/screens/JoinProjectScreen';
import AvailabilityScreen from '../features/availability/screens/AvailabilityScreen';
import CreateProjectScreen from '../features/projects/screens/CreateProjectScreen';
import AddRehearsalScreen from '../features/calendar/screens/AddRehearsalScreen';
import NotificationsScreen from '../features/notifications/screens/NotificationsScreen';
import RehearsalDetailsScreen from '../features/calendar/screens/RehearsalDetailsScreen';
import {
  AuthNavigator,
  CalendarNavigator,
  ProjectsNavigator,
  PlannerNavigator,
  ProfileNavigator,
} from './stacks';
import type { TabParamList, AppStackParamList, AppNavigation } from './types';

// Re-export types for consumers
export type {
  AuthStackParamList,
  CalendarStackParamList,
  ProjectsStackParamList,
  PlannerStackParamList,
  ProfileStackParamList,
  TabParamList,
  AppStackParamList,
  CalendarScreenNavigation,
  SmartPlannerNavigation,
  ProjectsScreenNavigation,
  ProjectDetailNavigation,
  AppNavigation,
} from './types';

// Context for ActionSheet state
const ActionSheetContext = createContext<{
  showActionSheet: boolean;
  setShowActionSheet: (show: boolean) => void;
} | null>(null);

const useActionSheet = () => {
  const context = useContext(ActionSheetContext);
  if (!context) {
    throw new Error('useActionSheet must be used within ActionSheetProvider');
  }
  return context;
};

const prefix = Linking.createURL('/');

const localhostPrefix = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001'
  : 'http://localhost:3001';

const linking: LinkingOptions<AppStackParamList> = {
  prefixes: [
    prefix,
    'rehearsalapp://',
    'https://rehearsly.me',
    // Kept so links handed out before the domain move still resolve
    'https://server-fertvads-projects.vercel.app',
    localhostPrefix
  ],
  config: {
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

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AppTabs = createBottomTabNavigator<TabParamList>();

// Empty component for Create tab - never actually shown
const EmptyCreateScreen = () => <View />;

// Custom tab button component for the center "+" button
// The "+" is only an icon, so it says what it is: VoiceOver read nothing here.
const CreateTabButton = React.memo(({ onPress, label }: { onPress: () => void; label: string }) => {
  return (
    <TouchableOpacity
      testID="tab-create"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={tabButtonStyles.container}
      onPress={() => {
        hapticMedium();
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={tabButtonStyles.iconContainer}>
        <Ionicons
          name="add-circle"
          size={56}
          color={Colors.accent.purple}
        />
      </View>
    </TouchableOpacity>
  );
});

CreateTabButton.displayName = 'CreateTabButton';

const tabButtonStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -14,
  },
});

// Wrapper component to handle ActionSheet navigation
function ActionSheetWrapper() {
  const navigation = useNavigation<AppNavigation<'MainTabs'>>();
  const { showActionSheet, setShowActionSheet } = useActionSheet();
  const { language } = useI18n();

  // Anyone can create a project: the paid tier was taken out of the app for
  // the App Store release — see docs/app-store-release.md
  const handleCreateProject = () => {
    setShowActionSheet(false);
    navigation.navigate('CreateProject');
  };

  return (
    <CreateActionSheet
      visible={showActionSheet}
      onClose={() => setShowActionSheet(false)}
      onCreateRehearsal={() => {
        setShowActionSheet(false);
        navigation.navigate('AddRehearsal', {});
      }}
      onMarkBusy={() => {
        setShowActionSheet(false);
        navigation.navigate('MarkBusy');
      }}
      onCreateProject={handleCreateProject}
    />
  );
}

// Wrapper component to handle push notifications
function NotificationsHandler() {
  useNotifications();
  return null;
}

function TabNavigator() {
  // The one place automatic calendar sync is watched for.
  //
  // It has to live somewhere mounted for the whole signed-in session, and the
  // tab bar is that. It used to be the availability editor, which is a modal
  // reached from the "+" button — so sync ran only while that sheet was open,
  // and anyone who never opened it got none at all despite the setting saying
  // otherwise. Nothing happens here when sync is switched off: the run reads
  // the settings first and returns.
  useAutoCalendarSync({ syncOnForeground: true });

  const { t } = useI18n();
  const { setShowActionSheet } = useActionSheet();

  const handleCreatePress = useCallback(() => {
    setShowActionSheet(true);
  }, [setShowActionSheet]);

  const renderCreateButton = useCallback(() => (
    <CreateTabButton onPress={handleCreatePress} label={t.actionSheet.title} />
  ), [handleCreatePress, t]);

  return (
    <>
      <BetaBanner />
      <AppTabs.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.bg.secondary,
            borderTopWidth: 1,
            borderTopColor: Colors.glass.border,
            paddingBottom: 28,
            paddingTop: 8,
            height: 80,
          },
          tabBarActiveTintColor: Colors.accent.purple,
          tabBarInactiveTintColor: Colors.text.secondary,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
          },
          tabBarItemStyle: {
            paddingHorizontal: 0,
          },
        }}
        screenListeners={{
          tabPress: () => {
            hapticLight();
          },
        }}
      >
        <AppTabs.Screen
          name="Calendar"
          component={CalendarNavigator}
          options={{
            tabBarLabel: t.nav.calendar,
            tabBarButtonTestID: 'tab-calendar',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <AppTabs.Screen
          name="Projects"
          component={ProjectsNavigator}
          options={{
            tabBarLabel: t.nav.projects,
            tabBarButtonTestID: 'tab-projects',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <AppTabs.Screen
          name="Create"
          component={EmptyCreateScreen}
          options={{
            tabBarLabel: t.nav.addRehearsal,
            tabBarButton: renderCreateButton,
          }}
        />
        <AppTabs.Screen
          name="Planner"
          component={PlannerNavigator}
          options={{
            tabBarLabel: t.nav.planner,
            tabBarButtonTestID: 'tab-planner',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <AppTabs.Screen
          name="Profile"
          component={ProfileNavigator}
          options={{
            tabBarLabel: t.nav.profile,
            tabBarButtonTestID: 'tab-profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" size={size} color={color} />
            ),
          }}
        />
      </AppTabs.Navigator>
      <ActionSheetWrapper />
      <NotificationsHandler />
    </>
  );
}

function AppNavigator() {
  const [showActionSheet, setShowActionSheet] = useState(false);

  const contextValue = React.useMemo(
    () => ({ showActionSheet, setShowActionSheet }),
    [showActionSheet]
  );

  return (
    <ActionSheetContext.Provider value={contextValue}>
      <AppStack.Navigator screenOptions={{ headerShown: false }}>
        <AppStack.Screen name="MainTabs" component={TabNavigator} />
        <AppStack.Screen
          name="JoinProject"
          component={JoinProjectScreen}
          options={{ presentation: 'modal' }}
        />
        <AppStack.Screen
          name="MarkBusy"
          component={AvailabilityScreen}
          options={{ presentation: 'modal' }}
        />
        <AppStack.Screen
          name="CreateProject"
          component={CreateProjectScreen}
          options={{ presentation: 'modal' }}
        />
        <AppStack.Screen
          name="AddRehearsal"
          component={AddRehearsalScreen}
          options={{ presentation: 'modal' }}
        />
        {/* Root level, not inside a tab: the bell is on the calendar but the
            inbox belongs to the whole app, and opening it should not drag the
            user into another tab to get back out. */}
        <AppStack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ presentation: 'modal' }}
        />
        {/* A route rather than a Modal rendered inside a screen. Mixing React
            Native's Modal with the navigator's own left iOS holding a layer
            over the calendar that swallowed every touch; here presentation and
            dismissal belong to one system and cannot collide. */}
        <AppStack.Screen
          name="RehearsalDetails"
          component={RehearsalDetailsScreen}
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 1],
            sheetCornerRadius: 20,
            // The grabber says "drag me" before anyone has to guess.
            sheetGrabberVisible: true,
            // Without this the navigator's own background shows through
            // wherever the screen does not reach — a white band under the sheet.
            contentStyle: { backgroundColor: Colors.bg.secondary },
          }}
        />
      </AppStack.Navigator>
    </ActionSheetContext.Provider>
  );
}

export default function Navigation() {
  const { user, isAuthenticated, loading } = useAuth();
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const navigationRef = useNavigationContainerRef<AppStackParamList>();

  const shouldShowOnboarding = isAuthenticated && !user?.onboardingCompleted;

  // Every invite link, whenever it arrives, only queues its code. Opening it is
  // the job of the one effect below. Navigating straight from here reached the
  // auth or onboarding stack whenever it was showing — neither has JoinProject,
  // so the call was dropped and the invite lost (HN01). The code is read by the
  // server's own format, whole — never a prefix of it.
  useEffect(() => {
    const handleUrl = (url: string) => {
      const code = inviteCodeFromUrl(url);
      if (code) {
        setPendingInviteCode(code);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // The queued invite is opened only once the app stack — the one that has
  // JoinProject — is mounted: signed in and past onboarding. Until then the
  // code waits, and is cleared only by the navigation that opens it.
  const appStackMounted = isAuthenticated && !shouldShowOnboarding;
  useEffect(() => {
    if (!appStackMounted || !pendingInviteCode) return;
    const timer = setTimeout(() => {
      if (!navigationRef.current) return;
      navigationRef.current.navigate('JoinProject', { code: pendingInviteCode });
      setPendingInviteCode(null);
    }, 500);
    return () => clearTimeout(timer);
  }, [appStackMounted, pendingInviteCode, navigationRef]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent.purple} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={isAuthenticated && !shouldShowOnboarding ? linking : undefined}
    >
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : shouldShowOnboarding ? (
        <OnboardingNavigator />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}
