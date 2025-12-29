import { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../../navigation';
import { Project, ProjectMember } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { checkSchedulingConflicts, formatConflictMessage } from '../../../shared/utils/conflictDetection';
import { dateTimeToISO } from '../../../shared/utils/time';
import { getSyncSettings } from '../../../shared/utils/calendarStorage';
import { syncRehearsalToCalendar } from '../../../shared/services/calendar';
import { formatDate, formatTime } from '../utils/rehearsalFormatters';
import { TimeRange } from '../../../shared/utils/availability';

type NavigationType = NativeStackNavigationProp<AppStackParamList>;

interface UseAddRehearsalSubmitProps {
  localSelectedProject: Project | null;
  date: Date;
  startTime: Date;
  endTime: Date;
  location: string;
  selectedMemberIds: string[];
  members: ProjectMember[];
  memberAvailability: Record<string, { timeRanges: TimeRange[] }>;
  resetForm: () => void;
  t: any;
  isEditMode: boolean;
  rehearsalId?: string;
}

export function useAddRehearsalSubmit({
  localSelectedProject,
  date,
  startTime,
  endTime,
  location,
  selectedMemberIds,
  members,
  memberAvailability,
  resetForm,
  t,
  isEditMode,
  rehearsalId,
}: UseAddRehearsalSubmitProps) {
  const navigation = useNavigation<NavigationType>();
  const [loading, setLoading] = useState(false);

  const saveRehearsal = async () => {
    setLoading(true);

    try {
      // Convert date + time to ISO timestamps
      const dateString = formatDate(date);
      const startTimeString = formatTime(startTime);
      const endTimeString = formatTime(endTime);

      const rehearsalData = {
        startsAt: dateTimeToISO(dateString, startTimeString),
        endsAt: dateTimeToISO(dateString, endTimeString),
        location: location.trim() || undefined,
        participant_ids: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      };

      let savedRehearsal;

      // Update or create based on mode
      if (isEditMode && rehearsalId) {
        const response = await rehearsalsAPI.update(
          localSelectedProject!.id,
          rehearsalId,
          rehearsalData
        );
        savedRehearsal = response.data.rehearsal || response.data;
      } else {
        const response = await rehearsalsAPI.create(localSelectedProject!.id, rehearsalData);
        savedRehearsal = response.data.rehearsal;
      }

      // Auto-sync to calendar if export is enabled
      try {
        const syncSettings = await getSyncSettings();

        if (syncSettings.exportEnabled && syncSettings.exportCalendarId && savedRehearsal?.id) {
          const rehearsalWithProject = {
            id: savedRehearsal.id,
            projectId: localSelectedProject!.id,
            projectName: localSelectedProject!.name,
            startsAt: rehearsalData.startsAt,
            endsAt: rehearsalData.endsAt,
            location: rehearsalData.location,
          };

          await syncRehearsalToCalendar(rehearsalWithProject, syncSettings.exportCalendarId);
        }
      } catch (syncError) {
        // Don't fail the whole operation if sync fails, just log it
        console.error('[AddRehearsal] Failed to auto-sync to calendar:', syncError);
      }

      // Success message based on mode
      const successMessage = isEditMode
        ? t.rehearsals.rehearsalUpdated
        : t.rehearsals.rehearsalCreated;

      Alert.alert(
        t.rehearsals.success,
        successMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Failed to save rehearsal:', error);
      const errorMessage = isEditMode
        ? t.rehearsals.updateError
        : t.rehearsals.createError;

      Alert.alert(
        t.common.error,
        error.response?.data?.error || error.message || errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!localSelectedProject) {
      Alert.alert(t.common.error, t.rehearsals.projectNotSelected);
      return;
    }

    if (endTime <= startTime) {
      Alert.alert(t.common.error, t.rehearsals.endTimeError);
      return;
    }

    // Check for scheduling conflicts
    if (selectedMemberIds.length > 0) {
      const selectedMembers = members.filter(m => selectedMemberIds.includes(m.userId));
      const rehearsalStart = formatTime(startTime);
      const rehearsalEnd = formatTime(endTime);

      const conflicts = checkSchedulingConflicts(
        selectedMembers,
        memberAvailability,
        rehearsalStart,
        rehearsalEnd
      );

      if (conflicts.hasConflicts) {
        const conflictMessage = formatConflictMessage(conflicts);

        // Show warning and ask for confirmation
        Alert.alert(
          t.rehearsals.scheduleConflict,
          `${conflictMessage}\n\n${t.rehearsals.scheduleConflictMessage}`,
          [
            {
              text: t.common.cancel,
              style: 'cancel',
            },
            {
              text: t.rehearsals.createAnyway,
              style: 'destructive',
              onPress: () => saveRehearsal(),
            },
          ]
        );
        return;
      }
    }

    // No conflicts, save rehearsal
    saveRehearsal();
  };

  return {
    loading,
    handleSubmit,
  };
}
