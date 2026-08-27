export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type CalendarStackParamList = {
  // openRehearsalId arrives from a tapped notification: the rehearsal's details
  // are a modal on this screen rather than a route of their own, so the id is
  // handed over and the screen opens it once the data is in.
  CalendarMain: { openRehearsalId?: string } | undefined;
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
  Notifications: undefined;
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
  // No code when opened from the create sheet — the screen asks for one
  JoinProject: { code?: string } | undefined;
  MarkBusy: undefined;
  CreateProject: undefined;
  AddRehearsal: {
    projectId?: string;
    rehearsalId?: string;
    prefilledDate?: string;
    prefilledTime?: string;
    prefilledEndTime?: string;
  };
};
