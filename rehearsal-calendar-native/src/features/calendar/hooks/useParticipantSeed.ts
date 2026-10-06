import { useEffect, useRef } from 'react';

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
  loading: boolean;
  /** The project the planner opened the form for, and the people it planned for. */
  plannedProjectId?: string;
  plannedMemberIds?: string[];
  setSelectedMemberIds: (ids: string[]) => void;
}

/**
 * Seeds the selection once per project, when that project's members are in.
 * The planner's people apply to the planner's project only: switching the form
 * to another project starts it with everyone, as a form opened anywhere else.
 * An edit keeps the rehearsal's own roster (useAddRehearsalForm).
 */
export function useParticipantSeed({
  isEditMode,
  projectId,
  memberIds,
  loading,
  plannedProjectId,
  plannedMemberIds,
  setSelectedMemberIds,
}: ParticipantSeedOptions) {
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (isEditMode || loading || !projectId || memberIds.length === 0) return;
    if (seededFor.current === projectId) return;
    seededFor.current = projectId;
    const fromPlanner = projectId === plannedProjectId ? plannedMemberIds : undefined;
    setSelectedMemberIds(initialParticipants(memberIds, fromPlanner));
  }, [isEditMode, loading, projectId, memberIds, plannedProjectId, plannedMemberIds, setSelectedMemberIds]);
}
