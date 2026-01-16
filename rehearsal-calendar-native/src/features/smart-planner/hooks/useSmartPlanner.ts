import { useState, useEffect, useMemo, useCallback } from 'react';
import { projectsAPI, rehearsalsAPI } from '../../../shared/services/api';
import type { Project, Rehearsal, ProjectMember } from '../../../shared/types';
import type { TimeSlot, SlotCategory, Member, AvailabilityData } from '../types';
import {
  generateTimeSlots,
  filterSlotsByCategory,
  countSlotsByCategory,
  groupSlotsByDate,
} from '../utils/slotGenerator';
import { mergeAvailabilityWithRehearsals, type MemberAvailability } from '../utils/availabilityMerger';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [memberAvailability, setMemberAvailability] = useState<MemberAvailability[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);

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

        logger.debug('[Smart Planner] Loading data for project:', projectId);
        logger.debug('[Smart Planner] Date range:', startDate, 'to', endDate);

        // Load project info, members, availability, and rehearsals in parallel
        const [projectRes, membersRes, availabilityRes, rehearsalsRes] = await Promise.all([
          projectsAPI.getProject(projectId),
          projectsAPI.getMembers(projectId),
          projectsAPI.getMembersAvailabilityRange(projectId, startDate, endDate),
          rehearsalsAPI.getAll(projectId),
        ]);

        if (!mounted) return;

        logger.debug('[Smart Planner] Project:', projectRes.data);
        logger.debug('[Smart Planner] Members:', membersRes.data.members.length);
        logger.debug('[Smart Planner] Availability:', availabilityRes.data.availability.length);
        logger.debug('[Smart Planner] Rehearsals:', rehearsalsRes.data.rehearsals.length);

        setProject(projectRes.data.project);
        setMembers(membersRes.data.members);
        setMemberAvailability(availabilityRes.data.availability);
        setRehearsals(rehearsalsRes.data.rehearsals);
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
  }, [projectId, startDate, endDate]);

  // Convert members to simple format for slot generator
  const simpleMembers: Member[] = useMemo(() => {
    return members.map(m => ({
      id: m.userId,
      name: `${m.firstName}${m.lastName ? ` ${m.lastName}` : ''}`,
    }));
  }, [members]);

  // Merge availability with rehearsals
  const mergedAvailability: AvailabilityData[] = useMemo(() => {
    if (simpleMembers.length === 0) return [];

    logger.debug('[Smart Planner] Merging availability with rehearsals');
    logger.debug('[Smart Planner] Simple members:', simpleMembers.length);
    logger.debug('[Smart Planner] Member availability:', memberAvailability.length);
    logger.debug('[Smart Planner] Rehearsals:', rehearsals.length);

    const merged = mergeAvailabilityWithRehearsals(
      simpleMembers,
      memberAvailability,
      rehearsals
    );

    logger.debug('[Smart Planner] Merged availability entries:', merged.length);
    return merged;
  }, [simpleMembers, memberAvailability, rehearsals]);

  // Generate time slots
  const allSlots: TimeSlot[] = useMemo(() => {
    if (!startDate || !endDate || simpleMembers.length === 0) {
      return [];
    }

    // If no members selected, use all members
    const memberIds = selectedMemberIds.length > 0
      ? selectedMemberIds
      : simpleMembers.map(m => m.id);

    logger.debug('[Smart Planner] Generating slots');
    logger.debug('[Smart Planner] Selected members:', memberIds.length);

    const slots = generateTimeSlots(
      startDate,
      endDate,
      simpleMembers,
      mergedAvailability,
      memberIds
    );

    logger.debug('[Smart Planner] Generated slots:', slots.length);
    return slots;
  }, [startDate, endDate, simpleMembers, mergedAvailability, selectedMemberIds]);

  // Filter slots by category
  const filteredSlots = useMemo(() => {
    const filtered = filterSlotsByCategory(allSlots, selectedCategories);
    logger.debug('[Smart Planner] Filtered slots:', filtered.length);
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
  };
}
