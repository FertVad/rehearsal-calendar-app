import type { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  // delivery is set when a registration has just sent the code; absent when a
  // sign-in found the address still unconfirmed.
  VerifyEmail: { email: string; delivery?: 'sent' | 'failed' | 'unknown' };
  // The address typed where the reset was opened from, if any.
  ResetPassword: { email?: string } | undefined;
};

export type CalendarStackParamList = {
  CalendarMain: undefined;
};

export type ProjectsStackParamList = {
  ProjectsMain: undefined;
  ProjectDetail: { projectId: string };
};

export type PlannerStackParamList = {
  PlannerMain: undefined;
  SmartPlanner: { projectId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  CalendarSyncSettings: undefined;
  EditProfile: undefined;
  ChangeEmail: undefined;
};

// Each tab holds its own stack, and the tabs sit inside the app stack. Said
// here, so that a navigate() across them is checked like any other: a route
// that does not exist is a compile error, not a tap that does nothing
// (review R9-03).
export type TabParamList = {
  Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  Projects: NavigatorScreenParams<ProjectsStackParamList> | undefined;
  Create: undefined;
  Planner: NavigatorScreenParams<PlannerStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  Notifications: undefined;
  RehearsalDetails: { rehearsalId: string };
  // No code when opened from the create sheet — the screen asks for one
  JoinProject: { code?: string } | undefined;
  MarkBusy: undefined;
  CreateProject: undefined;
  AddRehearsal: {
    projectId?: string;
    rehearsalId?: string;
    prefilledDate?: string;
    /** A start: the form ends it the usual length on (rehearsalDefaults.ts). */
    prefilledTime?: string;
    /** The people the planner planned the slot for; absent means everyone (DP02). */
    prefilledMemberIds?: string[];
  };
};

/** A screen in a tab's stack, reaching the other tabs and the app stack above them. */
type FromTab<Stack extends Record<string, object | undefined>, Screen extends keyof Stack & string, Tab extends keyof TabParamList> =
  CompositeNavigationProp<
    NativeStackNavigationProp<Stack, Screen>,
    CompositeNavigationProp<BottomTabNavigationProp<TabParamList, Tab>, NativeStackNavigationProp<AppStackParamList>>
  >;

export type CalendarScreenNavigation = FromTab<CalendarStackParamList, 'CalendarMain', 'Calendar'>;
export type SmartPlannerNavigation = FromTab<PlannerStackParamList, 'SmartPlanner', 'Planner'>;
export type ProjectsScreenNavigation = FromTab<ProjectsStackParamList, 'ProjectsMain', 'Projects'>;
export type ProjectDetailNavigation = FromTab<ProjectsStackParamList, 'ProjectDetail', 'Projects'>;

/**
 * A screen on the app stack, or a component that only leaves for the app
 * stack's routes from wherever it is rendered — navigate() goes up to the
 * navigator that has the route, and the route it names is checked here.
 */
export type AppNavigation<Screen extends keyof AppStackParamList = keyof AppStackParamList> =
  NativeStackNavigationProp<AppStackParamList, Screen>;
