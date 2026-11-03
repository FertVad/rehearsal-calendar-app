import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNow, useTimezone } from '../../../shared/hooks/useClock';
import { useI18n } from '../../../contexts/I18nContext';
import { projectsAPI } from '../../../shared/services/api';
import type { Project, ProjectMember } from '../../../shared/types';
import type { TimeSlot, SlotCategory, Member, AvailabilityData } from '../types';
import {
  generateTimeSlots,
  filterSlotsByCategory,
  countSlotsByCategory,
  groupSlotsByDate,
  NOW_STEP_MINUTES,
} from '../utils/slotGenerator';
import { mergeMemberAvailability, type MemberAvailability } from '../utils/availabilityMerger';
import { logger } from '../../../shared/utils/logger';
import { calendarRangeDays, memberAvailabilityLimits } from '../../../shared/utils/memberAvailabilityLimits';

interface UseSmartPlannerProps {
  projectId: string;
  startDate: string;
  endDate: string;
  selectedCategories: SlotCategory[];
  selectedMemberIds: string[];
}

export function useSmartPlanner({
  projectId,
  startDate,
  endDate,
  selectedCategories,
  selectedMemberIds,
}: UseSmartPlannerProps) {
  const { t } = useI18n();
  // The server answers in the profile's zone; a new zone is a new answer.
  const userTimezone = useTimezone();
  const rangeDays = calendarRangeDays(startDate, endDate);
  const rangeError = rangeDays === null
    ? t.common.invalidDateRange
    : rangeDays > memberAvailabilityLimits.maxDays
      ? t.common.dateRangeTooLong(memberAvailabilityLimits.maxDays)
      : null;
  const rangeKey = JSON.stringify([projectId, startDate, endDate, userTimezone]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersProjectId, setMembersProjectId] = useState<string | null>(null);
  const [memberAvailability, setMemberAvailability] = useState<MemberAvailability[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedRangeKey, setLoadedRangeKey] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Drop the previous project's data the moment the project changes. Without
  // this the roster of the old project stays on screen for the length of the
  // request, and anything derived from it — the member filter, the slot
  // recommendations — describes the wrong project.
  //
  // membersProjectId is reset here too: anything that reads simpleMembers and
  // needs to know which project those members belong to (e.g. the seeding
  // effect in SmartPlannerScreen) must wait until membersProjectId equals the
  // current projectId before acting — that is the only moment when the members
  // state is confirmed to be for the right project.
  useEffect(() => {
    setProject(null);
    setMembers([]);
    setMembersProjectId(null);
    setMemberAvailability([]);
  }, [projectId]);

  // Load all data
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (rangeError) {
        setError(rangeError);
        setMemberAvailability([]);
        setLoadedRangeKey(null);
        setLoading(false);
        return;
      }
      if (!projectId || !startDate || !endDate) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (__DEV__) {
          logger.debug('[Smart Planner] Loading data for project:', projectId);
          logger.debug('[Smart Planner] Date range:', startDate, 'to', endDate);
        }

        // Load project info, members and availability in parallel. Rehearsals
        // are not fetched: their hours already reach us as `source='rehearsal'`
        // rows inside the availability response, for the participants who were
        // actually called.
        const [projectRes, membersRes, availabilityRes] = await Promise.all([
          projectsAPI.getProject(projectId),
          projectsAPI.getMembers(projectId),
          projectsAPI.getMembersAvailabilityRange(projectId, startDate, endDate),
        ]);

        if (!mounted) return;

        if (__DEV__) {
          logger.debug('[Smart Planner] Project:', projectRes.data);
          logger.debug('[Smart Planner] Members:', membersRes.data.members.length);
          logger.debug('[Smart Planner] Availability:', availabilityRes.data.availability.length);
        }

        setProject(projectRes.data.project);
        setMembers(membersRes.data.members);
        setMembersProjectId(projectId);
        setMemberAvailability(availabilityRes.data.availability);
        setLoadedRangeKey(rangeKey);
      } catch (err: any) {
        logger.error('[Smart Planner] Error loading data:', err);
        if (mounted) {
          setError(err.response?.data?.error || err.message || 'Failed to load data');
          setMemberAvailability([]);
          setLoadedRangeKey(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [projectId, startDate, endDate, refreshKey, userTimezone, rangeError, rangeKey]);

  // Convert members to simple format for slot generator
  const simpleMembers: Member[] = useMemo(() => {
    return members.map(m => ({
      id: m.userId,
      name: `${m.firstName}${m.lastName ? ` ${m.lastName}` : ''}`,
      isAdmin: m.role === 'owner' || m.role === 'admin',
    }));
  }, [members]);

  // Collapse each member's overlapping busy ranges
  const mergedAvailability: AvailabilityData[] = useMemo(() => {
    if (simpleMembers.length === 0) return [];

    if (__DEV__) {
      logger.debug('[Smart Planner] Merging member availability');
      logger.debug('[Smart Planner] Simple members:', simpleMembers.length);
      logger.debug('[Smart Planner] Member availability:', memberAvailability.length);
    }

    const merged = mergeMemberAvailability(simpleMembers, memberAvailability);

    if (__DEV__) {
      logger.debug('[Smart Planner] Merged availability entries:', merged.length);
    }
    return merged;
  }, [simpleMembers, memberAvailability]);

  // Members being planned for who have never recorded any availability. They
  // count as free in every slot, so "Perfect — everyone available" is also what
  // a project where nobody has entered anything says about itself. The maths
  // cannot distinguish the two; the screen says which is which.
  const membersWithoutData: string[] = useMemo(() => {
    if (memberAvailability.length === 0) return [];

    const planningFor = selectedMemberIds.length > 0 ? new Set(selectedMemberIds) : null;
    return simpleMembers
      .filter(m => !planningFor || planningFor.has(m.id))
      .filter(m => memberAvailability.find(a => a.userId === m.id)?.hasData !== true)
      .map(m => m.name);
  }, [simpleMembers, memberAvailability, selectedMemberIds]);

  // Today's cut-off follows the clock: a planner left open from 10:05 kept
  // offering 10:30 at noon (review DP04). The clock moves in the generator's own
  // step, so a start drops out the minute after it begins (review R6-04).
  const now = useNow(NOW_STEP_MINUTES);

  // Generate time slots
  const allSlots: TimeSlot[] = useMemo(() => {
    // Check before generateTimeSlots walks the requested dates. A rejected or
    // pending range must not generate free slots from the previous response.
    if (rangeError || error || loading || loadedRangeKey !== rangeKey || simpleMembers.length === 0) {
      return [];
    }

    // If no members selected, use all members
    const memberIds = selectedMemberIds.length > 0
      ? selectedMemberIds
      : simpleMembers.map(m => m.id);

    if (__DEV__) {
      logger.debug('[Smart Planner] Generating slots');
      logger.debug('[Smart Planner] Selected members:', memberIds.length);
    }

    const slots = generateTimeSlots(
      startDate,
      endDate,
      simpleMembers,
      mergedAvailability,
      memberIds,
      undefined,
      undefined,
      now
    );

    if (__DEV__) {
      logger.debug('[Smart Planner] Generated slots:', slots.length);
    }
    return slots;
  }, [startDate, endDate, simpleMembers, mergedAvailability, selectedMemberIds,
    rangeError, error, loading, loadedRangeKey, rangeKey, now]);

  // Filter slots by category
  const filteredSlots = useMemo(() => {
    const filtered = filterSlotsByCategory(allSlots, selectedCategories);
    if (__DEV__) {
      logger.debug('[Smart Planner] Filtered slots:', filtered.length);
    }
    return filtered;
  }, [allSlots, selectedCategories]);

  // Count slots by category
  const categoryCounts = useMemo(() => {
    return countSlotsByCategory(allSlots);
  }, [allSlots]);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    return groupSlotsByDate(filteredSlots);
  }, [filteredSlots]);

  return {
    loading: loading && !rangeError,
    error: rangeError || error,
    project,
    members,
    simpleMembers,
    membersProjectId,
    membersWithoutData,
    allSlots,
    filteredSlots,
    categoryCounts,
    slotsByDate,
    refetch,
  };
}
