import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { projectsAPI } from '../../../shared/services/api';
import type { Project, ProjectMember } from '../../../shared/types';
import type { TimeSlot, SlotCategory, Member, AvailabilityData } from '../types';
import {
  generateTimeSlots,
  filterSlotsByCategory,
  countSlotsByCategory,
  groupSlotsByDate,
} from '../utils/slotGenerator';
import { mergeMemberAvailability, type MemberAvailability } from '../utils/availabilityMerger';
import { logger } from '../../../shared/utils/logger';

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
  const { user } = useAuth();
  const userTimezone = user?.timezone;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [memberAvailability, setMemberAvailability] = useState<MemberAvailability[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Drop the previous project's data the moment the project changes. Without
  // this the roster of the old project stays on screen for the length of the
  // request, and anything derived from it — the member filter, the slot
  // recommendations — describes the wrong project.
  useEffect(() => {
    setProject(null);
    setMembers([]);
    setMemberAvailability([]);
  }, [projectId]);

  // Load all data
  useEffect(() => {
    let mounted = true;

    async function loadData() {
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
        setMemberAvailability(availabilityRes.data.availability);
      } catch (err: any) {
        logger.error('[Smart Planner] Error loading data:', err);
        if (mounted) {
          setError(err.response?.data?.error || err.message || 'Failed to load data');
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
  }, [projectId, startDate, endDate, refreshKey, userTimezone]);

  // Convert members to simple format for slot generator
  const simpleMembers: Member[] = useMemo(() => {
    return members.map(m => ({
      id: m.userId,
      name: `${m.firstName}${m.lastName ? ` ${m.lastName}` : ''}`,
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

  // Generate time slots
  const allSlots: TimeSlot[] = useMemo(() => {
    if (!startDate || !endDate || simpleMembers.length === 0) {
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
      memberIds
    );

    if (__DEV__) {
      logger.debug('[Smart Planner] Generated slots:', slots.length);
    }
    return slots;
  }, [startDate, endDate, simpleMembers, mergedAvailability, selectedMemberIds]);

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
    loading,
    error,
    project,
    members,
    simpleMembers,
    allSlots,
    filteredSlots,
    categoryCounts,
    slotsByDate,
    refetch,
  };
}
