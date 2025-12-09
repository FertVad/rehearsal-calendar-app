import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../shared/constants/colors';
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
import SmartPlannerScreen from '../features/smart-planner/screens/SmartPlannerScreen';

const prefix = Linking.createURL('/');

const linking: any = {
  prefixes: [
    prefix,
    'rehearsalapp://',
    'https://rehearsal-calendar-app.onrender.com',
    'http://localhost:3001'
  ],
  config: {
    screens: {
      MainTabs: {
        path: 'tabs',
        screens: {
          Calendar: 'calendar',
          Projects: 'projects',
          Availability: 'availability',
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

export type TabParamList = {
  Calendar: undefined;
  Projects: undefined;
  Create: undefined;
  Availability: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  AddRehearsal: {
    projectId?: string;
    prefilledDate?: string;
    prefilledTime?: string;
    prefilledEndTime?: string;
  };
  CreateProject: undefined;
  JoinProject: { code: string };
  ProjectDetail: { projectId: string };
  SmartPlanner: { projectId: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const AppTabs = createBottomTabNavigator<TabParamList>();

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

function TabNavigator() {
  return (
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
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <AppTabs.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarLabel: 'Дом',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <AppTabs.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          tabBarLabel: 'Проекты',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder" size={size} color={color} />
          ),
        }}
      />
      <AppTabs.Screen
        name="Create"
        component={AddRehearsalScreen}
        options={{
          tabBarLabel: 'Создать',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size + 4} color={color} />
          ),
        }}
      />
      <AppTabs.Screen
        name="Availability"
        component={AvailabilityScreen}
        options={{
          tabBarLabel: 'Занятость',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <AppTabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </AppTabs.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AppStack.Screen name="MainTabs" component={TabNavigator} />
      <AppStack.Screen
        name="AddRehearsal"
        component={AddRehearsalScreen}
        options={{
          presentation: 'modal',
        }}
      />
      <AppStack.Screen
        name="CreateProject"
        component={CreateProjectScreen}
        options={{
          presentation: 'modal',
        }}
      />
      <AppStack.Screen
        name="JoinProject"
        component={JoinProjectScreen}
        options={{
          presentation: 'modal',
        }}
      />
      <AppStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
      />
      <AppStack.Screen
        name="SmartPlanner"
        component={SmartPlannerScreen}
      />
    </AppStack.Navigator>
  );
}

export default function Navigation() {
  const { isAuthenticated, loading } = useAuth();
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const navigationRef = React.useRef<any>(null);

  // Handle deep links for unauthenticated users
  useEffect(() => {
    const handleUrl = async (url: string) => {
      console.log('Received URL:', url);

      // Extract invite code from URL
      const inviteMatch = url.match(/invite\/([a-f0-9]+)/);
      if (inviteMatch) {
        const code = inviteMatch[1];
        console.log('Extracted invite code:', code);

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
