import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../features/auth/screens/LoginScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import CalendarScreen from '../features/calendar/screens/CalendarScreen';
import ProjectsScreen from '../features/projects/screens/ProjectsScreen';
import ProjectDetailScreen from '../features/projects/screens/ProjectDetailScreen';
import ProfileScreen from '../features/profile/screens/ProfileScreen';
import CalendarSyncSettingsScreen from '../features/profile/screens/CalendarSyncSettingsScreen';
import EditProfileScreen from '../features/profile/screens/EditProfileScreen';
import SmartPlannerScreen from '../features/smart-planner/screens/SmartPlannerScreen';
import SmartPlannerTabScreen from '../features/smart-planner/screens/SmartPlannerTabScreen';
import type {
  AuthStackParamList,
  CalendarStackParamList,
  ProjectsStackParamList,
  PlannerStackParamList,
  ProfileStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const CalendarStackNav = createNativeStackNavigator<CalendarStackParamList>();
const ProjectsStackNav = createNativeStackNavigator<ProjectsStackParamList>();
const PlannerStackNav = createNativeStackNavigator<PlannerStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();

export function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

export function CalendarNavigator() {
  return (
    <CalendarStackNav.Navigator
      initialRouteName="CalendarMain"
      screenOptions={{ headerShown: false }}
    >
      <CalendarStackNav.Screen name="CalendarMain" component={CalendarScreen} />
    </CalendarStackNav.Navigator>
  );
}

export function ProjectsNavigator() {
  return (
    <ProjectsStackNav.Navigator
      initialRouteName="ProjectsMain"
      screenOptions={{ headerShown: false }}
    >
      <ProjectsStackNav.Screen name="ProjectsMain" component={ProjectsScreen} />
      <ProjectsStackNav.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ headerShown: false }}
      />
    </ProjectsStackNav.Navigator>
  );
}

export function PlannerNavigator() {
  return (
    <PlannerStackNav.Navigator
      initialRouteName="PlannerMain"
      screenOptions={{ headerShown: false }}
    >
      <PlannerStackNav.Screen name="PlannerMain" component={SmartPlannerTabScreen} />
      <PlannerStackNav.Screen
        name="SmartPlanner"
        component={SmartPlannerScreen}
        options={{ headerShown: false }}
      />
    </PlannerStackNav.Navigator>
  );
}

export function ProfileNavigator() {
  return (
    <ProfileStackNav.Navigator
      initialRouteName="ProfileMain"
      screenOptions={{ headerShown: false }}
    >
      <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStackNav.Screen
        name="CalendarSyncSettings"
        component={CalendarSyncSettingsScreen}
        options={{ headerShown: false }}
      />
      <ProfileStackNav.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />

    </ProfileStackNav.Navigator>
  );
}
