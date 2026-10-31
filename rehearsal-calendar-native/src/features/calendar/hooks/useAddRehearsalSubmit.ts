import { logger } from '../../../shared/utils/logger';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../../navigation';
import { Project, ProjectMember } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { checkSchedulingConflicts, formatConflictMessage } from '../../../shared/utils/conflictDetection';
import {
  clockRangeToISO,
  formatDateToString,
  formatDateToTimeString,
  isEmptyClockRange,
} from '../../../shared/utils/time';
import { exportRehearsal } from '../../../shared/services/calendarSync';
import { emitDataChanged } from '../../../shared/utils/dataChanged';
import { TimeRange } from '../../../shared/utils/availability';
import { useIdempotencyKey } from '../../../shared/hooks/useIdempotencyKey';
import { useTimezone } from '../../../shared/hooks/useClock';
import type { RehearsalFields } from './useAddRehearsalForm';

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
  memberAvailability: Record<string, { timeRanges: TimeRange[]; nextDayRanges?: TimeRange[] }>;
  /** The availability is for the day and people shown (useRehearsalAvailability). */
  availabilityReady: boolean;
  availabilityFailed: boolean;
  reloadAvailability: () => void;
  resetForm: () => void;
  /** What the form holds, as it is sent (useAddRehearsalForm). */
  fields: RehearsalFields;
  /** What was sent is saved (useAddRehearsalForm). */
  markSaved: (sent: RehearsalFields) => void;
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
  fields,
  markSaved,
  t,
  isEditMode,
  rehearsalId,
}: UseAddRehearsalSubmitProps) {
  const navigation = useNavigation<NavigationType>();
  const [loading, setLoading] = useState(false);
  const idempotency = useIdempotencyKey();
  const userTimezone = useTimezone();

  /**
   * True once saved. `leaving`: saved from the question on the way out, which
   * closes the form itself — an alert raised over a sheet being dismissed
   * would go with it (useLeaveGuard).
   */
  const saveRehearsal = async (leaving: boolean): Promise<boolean> => {
    setLoading(true);
    // What goes, as the form held it when the save began (review T-013 r2).
    const sent = fields;

    try {
      // The date and the two clock times as the interval they are, in the
      // profile's zone, the one the form was filled in from (useAddRehearsalForm,
      // review DF01): an end before the start is the next morning (DF04).
      const { startsAt, endsAt } = clockRangeToISO(
        formatDateToString(date),
        formatDateToTimeString(startTime),
        formatDateToTimeString(endTime),
        userTimezone
      );

      const rehearsalData = {
        startsAt,
        endsAt,
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

      // Its event, in the sync's queue: after a run already going, which may
      // have read the rehearsal as it was before this save and would write
      // the old time back over the new one. The queue reads the export
      // settings when its turn comes; the save does not wait for it.
      if (savedRehearsal?.id) {
        exportRehearsal({
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
        }).catch((syncError) => {
          // Don't fail the whole operation if sync fails, just log it
          logger.error('[AddRehearsal] ❌ Failed to auto-sync to calendar:', syncError);
        });
      }

      // A list this form was not opened from — a project's, under the details
      // it was opened from (T-016) — reloads too.
      emitDataChanged('rehearsals');

      // Saved, as it was sent: the way out after it is not asked about
      // (useLeaveGuard).
      markSaved(sent);
      if (leaving) return true;

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
      return true;
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
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create, or Update: true once saved. Every save goes through useLeaveGuard,
   * which keeps the form as it is until this is answered (review T-013 r2).
   */
  const handleSubmit = async (leaving = false): Promise<boolean> => {
    // Validation
    if (!localSelectedProject) {
      Alert.alert(t.common.error, t.rehearsals.projectNotSelected);
      return false;
    }

    // Only the clock times count: the form's Date objects carry whatever day
    // they were made on, and an end before the start is the next day.
    if (isEmptyClockRange(formatDateToTimeString(startTime), formatDateToTimeString(endTime))) {
      Alert.alert(t.common.error, t.rehearsals.endTimeError);
      return false;
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
      return false;
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
      return false;
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
        const conflictMessage = formatConflictMessage(conflicts, t);

        // Show warning and ask for confirmation
        return new Promise((resolve) => Alert.alert(
          t.rehearsals.scheduleConflict,
          `${conflictMessage}\n\n${t.rehearsals.scheduleConflictMessage}`,
          [
            {
              text: t.common.cancel,
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: t.rehearsals.createAnyway,
              style: 'destructive',
              onPress: () => resolve(saveRehearsal(leaving)),
            },
          ]
        ));
      }
    }

    // No conflicts, save rehearsal
    return saveRehearsal(leaving);
  };

  /**
   * Create would go to the server as the form stands, without stopping at a
   * check that refuses it — asked before offering "Save" on the way out
   * (T-013). A conflict only asks, so it does not count.
   */
  const canSubmit = () =>
    !loading
    && Boolean(localSelectedProject)
    && !isEmptyClockRange(formatDateToTimeString(startTime), formatDateToTimeString(endTime))
    && participantsSettled
    && (selectedMemberIds.length === 0 || availabilityReady);

  return {
    loading,
    handleSubmit,
    canSubmit,
  };
}
