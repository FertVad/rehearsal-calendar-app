import React, { useEffect, useState, createContext, useContext } from 'react';
import { Platform, View, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { Colors } from '../shared/constants/colors';
import { CreateActionSheet } from '../shared/components/CreateActionSheet';
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import CalendarScreen from '../features/calendar/screens/CalendarScreen';
import AddRehearsalScreen from '../features/calendar/screens/AddRehearsalScreen';
import ProjectsScreen from '../features/projects/screens/ProjectsScreen';
import CreateProjectScreen from '../features/projects/screens/CreateProjectScreen';
import JoinProjectScreen from '../features/projects/screens/JoinProjectScreen';
import ProjectDetailScreen from '../features/projects/screens/ProjectDetailScreen';
import AvailabilityScreen from '../features/availability/screens/AvailabilityScreen';
import ProfileScreen from '../features/profile/screens/ProfileScreen';
import CalendarSyncSettingsScreen from '../features/profile/screens/CalendarSyncSettingsScreen';
import SmartPlannerScreen from '../features/smart-planner/screens/SmartPlannerScreen';
import SmartPlannerTabScreen from '../features/smart-planner/screens/SmartPlannerTabScreen';

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

// Platform-specific localhost for deep links
// Android emulator needs 10.0.2.2 to reach host machine
const localhostPrefix = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001'
  : 'http://localhost:3001';

const linking: any = {
  prefixes: [
    prefix,
    'rehearsalapp://',
    'https://rehearsal-calendar-app.onrender.com',
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

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type CalendarStackParamList = {
  CalendarMain: undefined;
  AddRehearsal: {
    projectId?: string;
    rehearsalId?: string;
    prefilledDate?: string;
    prefilledTime?: string;
    prefilledEndTime?: string;
  };
};

export type ProjectsStackParamList = {
  ProjectsMain: undefined;
  CreateProject: undefined;
  ProjectDetail: { projectId: string };
};

export type PlannerStackParamList = {
  PlannerMain: undefined;
  SmartPlanner: { projectId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  CalendarSyncSettings: undefined;
  Availability: undefined;
};

export type TabParamList = {
  Calendar: undefined;
  Projects: undefined;
  Create: undefined;
  Planner: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  JoinProject: { code: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const AppTabs = createBottomTabNavigator<TabParamList>();
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();
const ProjectsStack = createNativeStackNavigator<ProjectsStackParamList>();
const PlannerStack = createNativeStackNavigator<PlannerStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// Calendar Stack Navigator
function CalendarNavigator() {
  return (
    <CalendarStack.Navigator
      initialRouteName="CalendarMain"
      screenOptions={{
        headerShown: false,
      }}
    >
      <CalendarStack.Screen name="CalendarMain" component={CalendarScreen} />
      <CalendarStack.Screen
        name="AddRehearsal"
        component={AddRehearsalScreen}
        options={{
          presentation: 'modal',
        }}
      />
    </CalendarStack.Navigator>
  );
}

// Projects Stack Navigator
function ProjectsNavigator() {
  return (
    <ProjectsStack.Navigator
      initialRouteName="ProjectsMain"
      screenOptions={{
        headerShown: false,
      }}
    >
      <ProjectsStack.Screen name="ProjectsMain" component={ProjectsScreen} />
      <ProjectsStack.Screen
        name="CreateProject"
        component={CreateProjectScreen}
        options={{
          presentation: 'modal',
        }}
      />
      <ProjectsStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
      />
    </ProjectsStack.Navigator>
  );
}

// Planner Stack Navigator
function PlannerNavigator() {
  return (
    <PlannerStack.Navigator
      initialRouteName="PlannerMain"
      screenOptions={{
        headerShown: false,
      }}
    >
      <PlannerStack.Screen name="PlannerMain" component={SmartPlannerTabScreen} />
      <PlannerStack.Screen
        name="SmartPlanner"
        component={SmartPlannerScreen}
      />
    </PlannerStack.Navigator>
  );
}

// Profile Stack Navigator
function ProfileNavigator() {
  return (
    <ProfileStack.Navigator
      initialRouteName="ProfileMain"
      screenOptions={{
        headerShown: false,
      }}
    >
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen
        name="CalendarSyncSettings"
        component={CalendarSyncSettingsScreen}
      />
      <ProfileStack.Screen
        name="Availability"
        component={AvailabilityScreen}
      />
    </ProfileStack.Navigator>
  );
}

// Empty component for Create tab - never actually shown
const EmptyCreateScreen = () => <View />;

// Custom tab button component for the center "+" button
const CreateTabButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity
      style={tabButtonStyles.container}
      onPress={onPress}
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
};

const tabButtonStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -14, // Align bottom edge with text baseline
  },
});

// Wrapper component to handle ActionSheet navigation
// Must use double-nested navigation since this is outside TabNavigator
function ActionSheetWrapper() {
  const navigation = useNavigation<any>();
  const { showActionSheet, setShowActionSheet } = useActionSheet();

  return (
    <CreateActionSheet
      visible={showActionSheet}
      onClose={() => setShowActionSheet(false)}
      onCreateRehearsal={() => {
        setShowActionSheet(false);
        navigation.navigate('MainTabs', {
          screen: 'Calendar',
          params: { screen: 'AddRehearsal', params: {} }
        });
      }}
      onMarkBusy={() => {
        setShowActionSheet(false);
        navigation.navigate('MainTabs', {
          screen: 'Profile',
          params: { screen: 'Availability' }
        });
      }}
      onCreateProject={() => {
        setShowActionSheet(false);
        navigation.navigate('MainTabs', {
          screen: 'Projects',
          params: { screen: 'CreateProject' }
        });
      }}
    />
  );
}

function TabNavigator() {
  const { t } = useI18n();
  const { showActionSheet, setShowActionSheet } = useActionSheet();

  return (
    <>
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
            tabBarButton: (props) => (
              <CreateTabButton onPress={() => setShowActionSheet(true)} />
            ),
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
    </>
  );
}

function AppNavigator() {
  const [showActionSheet, setShowActionSheet] = useState(false);

  return (
    <ActionSheetContext.Provider value={{ showActionSheet, setShowActionSheet }}>
      <AppStack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <AppStack.Screen name="MainTabs" component={TabNavigator} />
        <AppStack.Screen
          name="JoinProject"
          component={JoinProjectScreen}
          options={{
            presentation: 'modal',
          }}
        />
      </AppStack.Navigator>
    </ActionSheetContext.Provider>
  );
}

export default function Navigation() {
  const { isAuthenticated, loading } = useAuth();
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const navigationRef = React.useRef<any>(null);

  // Handle deep links for unauthenticated users
  useEffect(() => {
    const handleUrl = async (url: string) => {
      // Extract invite code from URL
      const inviteMatch = url.match(/invite\/([a-f0-9]+)/);
      if (inviteMatch) {
        const code = inviteMatch[1];

        if (isAuthenticated && navigationRef.current) {
          // User is authenticated, navigate directly
          navigationRef.current.navigate('JoinProject', { code });
        } else {
          // User not authenticated, save for later
          setPendingInviteCode(code);
        }
      }
    };

    // Handle initial URL (app opened from link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    // Handle URL when app is already open
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
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        navigationRef.current?.navigate('JoinProject', { code: pendingInviteCode });
        setPendingInviteCode(null);
      }, 500);
    }
  }, [isAuthenticated, pendingInviteCode]);

  if (loading) {
    // TODO: Add proper loading screen later
    return null;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={isAuthenticated ? linking : undefined}
    >
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
