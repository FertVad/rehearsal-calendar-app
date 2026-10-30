import type { Project } from '../types';

/**
 * Who may put a rehearsal in a project: its admins, as the server has it
 * ("Only admins can create rehearsals"). The ways into the rehearsal form —
 * the planner's "+ Add", "Create Rehearsal" in the "+" sheet, a long press on
 * a day — are shown only to someone this lets through. Shown to anyone, they
 * opened a form whose project list read "No projects where you are an
 * administrator" (T-012). Hidden, not dimmed: a sheet lists what the person
 * can do (HIG, context menus).
 */
export const canScheduleIn = (project: Project | null | undefined): boolean =>
  Boolean(project?.is_admin);

/** Someone who may put a rehearsal in at least one of `projects`. */
export const canScheduleAny = (projects: readonly Project[]): boolean =>
  projects.some(canScheduleIn);
