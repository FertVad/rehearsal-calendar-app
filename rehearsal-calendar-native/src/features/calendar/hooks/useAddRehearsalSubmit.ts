import { logger } from '../../../shared/utils/logger';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../../navigation';
import { Project, ProjectMember } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { checkSchedulingConflicts, formatConflictMessage } from '../../../shared/utils/conflictDetection';
import { dateTimeToISOInTimezone, formatDateToString, formatDateToTimeString } from '../../../shared/utils/time';
import { getSyncSettings } from '../../../shared/utils/calendarStorage';
import { syncRehearsalToCalendar } from '../../../shared/services/calendar';
import { TimeRange } from '../../../shared/utils/availability';
import { useIdempotencyKey } from '../../../shared/hooks/useIdempotencyKey';
import { useTimezone } from '../../../shared/hooks/useClock';

type NavigationType = NativeStackNavigationProp<AppStackParamList>;

interface UseAddRehearsalSubmitProps {
  localSelectedProject: Project | null;
  date: Date;
  startTime: Date;
  endTime: Date;
  title: string;
  location: string;
  selectedMemberIds: string[];
  /** The participants are settled for this project (useAddRehearsalForm). */
  participantsSettled: boolean;
  /** The project's members could not be loaded, and a retry for that. */
  membersFailed: boolean;
  reloadMembers: () => void;
  members: ProjectMember[];
  memberAvailability: Record<string, { timeRanges: TimeRange[] }>;
  /** The availability is for the day and people shown (useRehearsalAvailability). */
  availabilityReady: boolean;
  availabilityFailed: boolean;
  reloadAvailability: () => void;
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
  title,
  location,
  selectedMemberIds,
  participantsSettled,
  membersFailed,
  reloadMembers,
  members,
  memberAvailability,
  availabilityReady,
  availabilityFailed,
  reloadAvailability,
  resetForm,
  t,
  isEditMode,
  rehearsalId,
}: UseAddRehearsalSubmitProps) {
  const navigation = useNavigation<NavigationType>();
  const [loading, setLoading] = useState(false);
  const idempotency = useIdempotencyKey();
  const userTimezone = useTimezone();

  const saveRehearsal = async () => {
    setLoading(true);

    try {
      // The form's wall clocks, in the zone the form was filled in from — the
      // profile's (useAddRehearsalForm, review DF01).
      const dateString = formatDateToString(date);
      const startTimeString = formatDateToTimeString(startTime);
      const endTimeString = formatDateToTimeString(endTime);

      const rehearsalData = {
        startsAt: dateTimeToISOInTimezone(dateString, startTimeString, userTimezone),
        endsAt: dateTimeToISOInTimezone(dateString, endTimeString, userTimezone),
        // Optional: an untitled rehearsal is perfectly normal, so send
        // undefined rather than an empty string.
        title: title.trim() || undefined,
        location: location.trim() || undefined,
        // The whole roster, always. [] clears it; leaving the field out keeps
        // the old one, which is how unselecting everyone used to save nothing
        // (review DF02).
        participant_ids: selectedMemberIds,
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
        // The same form sent again after a lost answer gets the rehearsal the
        // first try made, not a second one (useIdempotencyKey).
        const projectId = localSelectedProject!.id;
        const response = await rehearsalsAPI.create(projectId, rehearsalData,
          idempotency.keyFor({ projectId, rehearsalData }));
        idempotency.settle();
        savedRehearsal = response.data.rehearsal;
      }

      // Auto-sync to calendar if export is enabled
      try {
        const syncSettings = await getSyncSettings();
        logger.debug('[AddRehearsal] 🔍 Checking calendar sync settings:', {
          exportEnabled: syncSettings.exportEnabled,
          exportCalendarId: syncSettings.exportCalendarId,
          savedRehearsalId: savedRehearsal?.id,
        });

        if (syncSettings.exportEnabled && syncSettings.exportCalendarId && savedRehearsal?.id) {
          logger.debug('[AddRehearsal] ✅ All conditions met, syncing to calendar...');
          const rehearsalWithProject = {
            id: savedRehearsal.id,
            projectId: localSelectedProject!.id,
            projectName: localSelectedProject!.name,
            startsAt: rehearsalData.startsAt,
            endsAt: rehearsalData.endsAt,
            location: rehearsalData.location,
            // Without this the event is written the moment the rehearsal is
            // saved and carries no name, so it reads "Rehearsal: <project>"
            // until some later sync corrects it.
            title: rehearsalData.title,
          };

          logger.debug('[AddRehearsal] 📤 Calling syncRehearsalToCalendar with:', {
            rehearsalId: rehearsalWithProject.id,
            projectName: rehearsalWithProject.projectName,
            calendarId: syncSettings.exportCalendarId,
          });

          await syncRehearsalToCalendar(rehearsalWithProject, syncSettings.exportCalendarId);
          logger.debug('[AddRehearsal] ✅ Calendar sync successful!');
        } else {
          logger.debug('[AddRehearsal] ⚠️ Calendar sync skipped. Reasons:', {
            exportNotEnabled: !syncSettings.exportEnabled,
            noCalendarSelected: !syncSettings.exportCalendarId,
            noRehearsalId: !savedRehearsal?.id,
          });
        }
      } catch (syncError) {
        // Don't fail the whole operation if sync fails, just log it
        logger.error('[AddRehearsal] ❌ Failed to auto-sync to calendar:', syncError);
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
      logger.error('Failed to save rehearsal:', error);
      const errorMessage = isEditMode
        ? t.rehearsals.updateError
        : t.rehearsals.createError;

      // Someone chosen left the project while the form was open: the server
      // refuses the whole list rather than quietly dropping them.
      const participantsLeft = error.response?.data?.code === 'NOT_PROJECT_MEMBERS';
      Alert.alert(
        t.common.error,
        participantsLeft ? t.rehearsals.participantsLeft
          : error.response?.data?.error || error.message || errorMessage
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

    // Nobody is sent until the participants are settled: the list goes as the
    // whole roster, and one sent while the members were loading — or after
    // they failed to load — put nobody on the rehearsal (review R9-02).
    if (!participantsSettled) {
      if (membersFailed) {
        Alert.alert(t.common.error, t.rehearsals.loadMembersError, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.common.retry, onPress: reloadMembers },
        ]);
      } else {
        Alert.alert(t.common.error, t.rehearsals.participantsLoading);
      }
      return;
    }

    // The conflict check reads the availability of the day shown: one still
    // loading, or failed, is not "nobody is busy" (DF05).
    if (selectedMemberIds.length > 0 && !availabilityReady) {
      if (availabilityFailed) {
        Alert.alert(t.common.error, t.rehearsals.loadAvailabilityError, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.common.retry, onPress: reloadAvailability },
        ]);
      } else {
        Alert.alert(t.common.error, t.rehearsals.availabilityChecking);
      }
      return;
    }

    // Check for scheduling conflicts
    if (selectedMemberIds.length > 0) {
      const selectedMembers = members.filter(m => selectedMemberIds.includes(m.userId));
      const rehearsalStart = formatDateToTimeString(startTime);
      const rehearsalEnd = formatDateToTimeString(endTime);

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
