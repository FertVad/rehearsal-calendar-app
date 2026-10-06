import { useEffect } from 'react';

/**
 * Who a new rehearsal starts with: the people the planner planned it for, when
 * it came from the planner, else everyone (DP02).
 *
 * The planner works out its times for the members picked in it — two actors of
 * ten, say — and the form used to open with all ten selected, the busy ones
 * included: the slot it offered was free for a cast nobody had chosen. Only
 * those still in the project are taken; someone who has left since is not put
 * on the rehearsal by an old list.
 */
export function initialParticipants(memberIds: string[], fromPlanner?: string[]): string[] {
  if (!fromPlanner || fromPlanner.length === 0) return memberIds;
  const planned = new Set(fromPlanner.map(String));
  return memberIds.filter((id) => planned.has(String(id)));
}

interface ParticipantSeedOptions {
  isEditMode: boolean;
  /** The project the form is on. */
  projectId: string | null | undefined;
  /** Its members — only that project's (useRehearsalMembers). */
  memberIds: string[];
  /** The members are that project's, loaded, and the load did not fail. */
  membersReady: boolean;
  /** The participants are already settled for this project (useAddRehearsalForm). */
  participantsSettled: boolean;
  /** The project the planner opened the form for, and the people it planned for. */
  plannedProjectId?: string;
  plannedMemberIds?: string[];
  startParticipants: (projectId: string, ids: string[]) => void;
}

/**
 * Settles a new rehearsal's participants when the project the form is on has
 * none settled and its members are in: the planner's people on the planner's
 * project, everyone on any other. Arriving at a project — at the start, or by
 * switching to it — always starts it this way, whatever happened to a
 * project visited in between; picking the project already shown changes
 * nothing, and a selection the person cleared stays clear (review R9-01). An
 * edit settles from the rehearsal's own roster instead (useAddRehearsalForm).
 */
export function useParticipantSeed({
  isEditMode,
  projectId,
  memberIds,
  membersReady,
  participantsSettled,
  plannedProjectId,
  plannedMemberIds,
  startParticipants,
}: ParticipantSeedOptions) {
  useEffect(() => {
    if (isEditMode || !projectId || !membersReady || participantsSettled) return;
    const fromPlanner = projectId === plannedProjectId ? plannedMemberIds : undefined;
    startParticipants(projectId, initialParticipants(memberIds, fromPlanner));
  }, [isEditMode, projectId, memberIds, membersReady, participantsSettled, plannedProjectId, plannedMemberIds,
    startParticipants]);
}
