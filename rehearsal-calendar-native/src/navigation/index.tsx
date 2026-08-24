import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Platform, View, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { Colors } from '../shared/constants/colors';
import { hapticLight, hapticMedium } from '../shared/utils/haptics';
import { CreateActionSheet } from '../shared/components/CreateActionSheet';
import { useNotifications } from '../shared/hooks/useNotifications';
import { BetaBanner } from '../shared/components/BetaBanner';
import { OnboardingNavigator } from '../features/onboarding';
import JoinProjectScreen from '../features/projects/screens/JoinProjectScreen';
import AvailabilityScreen from '../features/availability/screens/AvailabilityScreen';
import CreateProjectScreen from '../features/projects/screens/CreateProjectScreen';
import AddRehearsalScreen from '../features/calendar/screens/AddRehearsalScreen';
import {
  AuthNavigator,
  CalendarNavigator,
  ProjectsNavigator,
  PlannerNavigator,
  ProfileNavigator,
} from './stacks';
import type { TabParamList, AppStackParamList } from './types';

// Re-export types for consumers
export type {
  AuthStackParamList,
  CalendarStackParamList,
  ProjectsStackParamList,
  PlannerStackParamList,
  ProfileStackParamList,
  TabParamList,
  AppStackParamList,
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

const linking: any = {
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
    },
  },
};

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AppTabs = createBottomTabNavigator<TabParamList>();

// Empty component for Create tab - never actually shown
const EmptyCreateScreen = () => <View />;

// Custom tab button component for the center "+" button
const CreateTabButton = React.memo(({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity
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
  const navigation = useNavigation<any>();
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
  const { t } = useI18n();
  const { setShowActionSheet } = useActionSheet();

  const handleCreatePress = useCallback(() => {
    setShowActionSheet(true);
  }, [setShowActionSheet]);

  const renderCreateButton = useCallback(() => (
    <CreateTabButton onPress={handleCreatePress} />
  ), [handleCreatePress]);

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
          component={AvailabilityScreen as any}
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
      </AppStack.Navigator>
    </ActionSheetContext.Provider>
  );
}

export default function Navigation() {
  const { user, isAuthenticated, loading } = useAuth();
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const navigationRef = React.useRef<any>(null);

  const shouldShowOnboarding = isAuthenticated && !user?.onboardingCompleted;

  // Handle deep links for unauthenticated users
  useEffect(() => {
    const handleUrl = async (url: string) => {
      const inviteMatch = url.match(/invite\/([a-f0-9]+)/);
      if (inviteMatch) {
        const code = inviteMatch[1];

        if (isAuthenticated && navigationRef.current) {
          navigationRef.current.navigate('JoinProject', { code });
        } else {
          setPendingInviteCode(code);
        }
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
  }, [isAuthenticated]);

  // Navigate to invite when user logs in
  useEffect(() => {
    if (isAuthenticated && pendingInviteCode && navigationRef.current) {
      setTimeout(() => {
        navigationRef.current?.navigate('JoinProject', { code: pendingInviteCode });
        setPendingInviteCode(null);
      }, 500);
    }
  }, [isAuthenticated, pendingInviteCode]);

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
