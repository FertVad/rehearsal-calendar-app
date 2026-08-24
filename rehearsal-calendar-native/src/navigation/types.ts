export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
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
