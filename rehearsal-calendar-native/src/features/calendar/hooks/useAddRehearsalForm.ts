import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../../navigation';
import { Project } from '../../../shared/types';
import {
  endsNextDay,
  formatDateToTimeString,
  isEmptyClockRange,
  parseTimeString,
  todayIn,
  wallClockIn,
} from '../../../shared/utils/time';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useI18n } from '../../../contexts/I18nContext';
import { useTimezone } from '../../../shared/hooks/useClock';
import { endAfter, nextRoundHour } from '../utils/rehearsalDefaults';
import { useUsualDuration } from './useUsualDuration';

import { logger } from '../../../shared/utils/logger';
type NavigationType = NativeStackNavigationProp<AppStackParamList>;

interface RouteParams {
  projectId?: string;
  rehearsalId?: string;
  prefilledDate?: string;
  /** A start only: the end is the form's own rule (rehearsalDefaults.ts). */
  prefilledTime?: string;
}

interface UseAddRehearsalFormProps {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  routeParams?: RouteParams;
}

export function useAddRehearsalForm({
  projects,
  selectedProject,
  setSelectedProject,
  routeParams,
}: UseAddRehearsalFormProps) {
  const navigation = useNavigation<NavigationType>();
  const { language, t } = useI18n();

  // Extract route params
  const { projectId: prefilledProjectId, prefilledDate, prefilledTime } = routeParams || {};

  // Filter projects - only show where user is admin
  const adminProjects = useMemo(() => projects.filter(p => p.is_admin), [projects]);

  // Get the most recent admin project (by created_at or createdAt)
  const defaultProject = useMemo((): Project | null => {
    if (adminProjects.length === 0) return null;

    // Sort by creation date (newest first)
    const sorted = [...adminProjects].sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      return dateB - dateA; // Newest first
    });

    return sorted[0];
  }, [adminProjects]);

  // The form's date and times are wall clocks in the profile's zone (time.ts):
  // what the pickers show is what the submit reads, in the zone it writes in.
  // The edit used to open on the device's clock and save on the profile's, so
  // where the two differed an edit saved unchanged moved the rehearsal by the
  // difference (review DF01).
  const timezone = useTimezone();

  // A new rehearsal starts at the next whole hour, on its day: the hour it was
  // already was gone (07:00 at 07:02), and after 23:00 the next one is tomorrow.
  const [opening] = useState(() => nextRoundHour(wallClockIn(timezone)));
  const [date, setDate] = useState(opening);
  const [startTime, setStartTime] = useState(opening);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(
    selectedProject?.is_admin ? selectedProject : null
  );
  // The end is the usual length after the start until someone sets it: picked
  // in its picker, or an edit's own. It follows the start, and the project's
  // usual length once that is in (rehearsalDefaults.ts).
  const isEditMode = Boolean(routeParams?.rehearsalId && routeParams?.projectId);
  const usualMinutes = useUsualDuration(isEditMode ? null : localSelectedProject);
  const [chosenEnd, setEndTime] = useState<Date | null>(null);
  const endTime = useMemo(
    () => chosenEnd ?? endAfter(startTime, usualMinutes),
    [chosenEnd, startTime, usualMinutes]
  );
  // Who is on the rehearsal, for which project, and whether that is settled
  // (review R9-01, R9-02). One owner: the project switch empties it and marks
  // it unsettled, starting it settles it — from the edited rehearsal's roster,
  // or for a new one from the project's members (useParticipantSeed) — and
  // a choice in the form changes the people and nothing else. Settled for
  // another project than the one shown is not settled.
  const [participants, setParticipants] = useState<{ projectId: string | null; ids: string[]; settled: boolean }>({
    projectId: null,
    ids: [],
    settled: false,
  });
  const selectedMemberIds = participants.ids;
  const setSelectedMemberIds = useCallback(
    (ids: string[]) => setParticipants((current) => ({ ...current, ids })),
    []
  );
  const startParticipants = useCallback(
    (projectId: string, ids: string[]) => setParticipants({ projectId, ids, settled: true }),
    []
  );

  // UI state - separate state for each modal picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  // An edit is what the route says it is, from the first render (isEditMode
  // above): a form that read it from state set in an effect could act as a new
  // rehearsal for a frame (review R9-01).
  const [loadingRehearsal, setLoadingRehearsal] = useState(false);

  // Prefill form from route params
  useEffect(() => {
    if (prefilledProjectId) {
      const project = projects.find(p => p.id === prefilledProjectId);
      if (project && project.is_admin) {
        setLocalSelectedProject(project);
        setSelectedProject(project);
      }
    }

    if (prefilledDate && !prefilledTime) {
      // A day with no time - a long press in the calendar - starts at the
      // opening's hour on that day. Today it is the opening itself, date and
      // all: at 23:30 that is midnight tomorrow, not 00:00 today, which had
      // gone (T-012 review).
      const onDay = new Date(prefilledDate + 'T00:00:00');
      onDay.setHours(opening.getHours());
      const start = prefilledDate === todayIn(timezone) ? opening : onDay;
      setDate(start);
      setStartTime(start);
    } else if (prefilledDate) {
      setDate(new Date(prefilledDate + 'T00:00:00'));
    }

    if (prefilledTime) {
      setStartTime(parseTimeString(prefilledTime));
    }
  }, [prefilledProjectId, prefilledDate, prefilledTime, projects]);

  // Update selected project when projects list changes or default changes
  useEffect(() => {
    // Don't override if we have a prefilled project
    if (prefilledProjectId) return;

    // If current selection is not an admin project, select the default
    if (localSelectedProject && !localSelectedProject.is_admin) {
      setLocalSelectedProject(defaultProject);
      if (defaultProject) {
        setSelectedProject(defaultProject);
      }
    } else if (!localSelectedProject && defaultProject) {
      // If no project selected and there is a default, select it
      setLocalSelectedProject(defaultProject);
      setSelectedProject(defaultProject);
    }
  }, [defaultProject, prefilledProjectId]);

  // Load rehearsal data in edit mode
  useEffect(() => {
    const { rehearsalId, projectId } = routeParams || {};

    if (!rehearsalId || !projectId) return;

    const loadRehearsal = async () => {
      setLoadingRehearsal(true);

      try {
        // By id, not from the calendar batch: the batch is the caller's own
        // calendar, so an admin who was not on a rehearsal could not open it
        // for editing at all (review D04).
        const rehearsalResponse = await rehearsalsAPI.getById(String(rehearsalId));
        const rehearsal = rehearsalResponse.data.rehearsal;

        // Prefill form fields
        const startsAt = wallClockIn(timezone, rehearsal.startsAt);
        const endsAt = wallClockIn(timezone, rehearsal.endsAt);

        setDate(startsAt);
        setStartTime(startsAt);
        setEndTime(endsAt);
        setTitle(rehearsal.title || '');
        setLocation(rehearsal.location || '');

        // The roster as the server reads it: the people on the rehearsal who are
        // still in the project, whatever their answer — 'no' means invited and
        // not yet seen, and leaving them unselected would drop them on save.
        const responsesResponse = await rehearsalsAPI.getResponses(String(rehearsalId));
        const onRehearsal = responsesResponse.data.allParticipants || [];
        startParticipants(String(projectId), onRehearsal.map((p: any) => String(p.userId)));
      } catch (error: any) {
        // An edit sends the whole participant list, and an empty one clears the
        // call. A form left open over a failed load could save exactly that
        // (review DF03), so a form that could not load closes.
        logger.error('Failed to load rehearsal:', error);
        const gone = error?.response?.status === 404;
        Alert.alert(t.common.error, gone ? t.rehearsals.notFound : t.rehearsals.loadRehearsalError);
        navigation.goBack();
      } finally {
        setLoadingRehearsal(false);
      }
    };

    loadRehearsal();
  }, [routeParams?.rehearsalId]);

  // Handlers
  // A recommendation is free time, not a rehearsal: it gives the start, and the
  // end is the usual length on (T-012).
  const handleTimeSelect = (startTime: string) => {
    setStartTime(parseTimeString(startTime, date));
    setEndTime(null);
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
  };

  const openStartTimePicker = () => {
    setShowStartTimePicker(true);
  };

  const openEndTimePicker = () => {
    setShowEndTimePicker(true);
  };

  // Called with a confirmed value only: Cancel in the picker never reaches the
  // form, nor the end moved along with a start (usePickerDraft, HC02).
  const handleDateChange = (selectedDate: Date) => {
    setDate(selectedDate);
  };

  // The form's times are clock times on `date`; an end before the start is the
  // next morning (clockRangeToISO, cause fix 15).
  const startClock = formatDateToTimeString(startTime);
  const endClock = formatDateToTimeString(endTime);

  const handleStartTimeChange = (selectedTime: Date) => {
    setStartTime(selectedTime);
    // An end nobody set follows the start. One that was set stays, unless a
    // later start passes it: then it goes back to following — the usual length
    // on, which may well be the next morning. A rehearsal that already ran
    // overnight keeps its end, unless the start lands right on it.
    const start = formatDateToTimeString(selectedTime);
    const wasOvernight = endsNextDay(startClock, endClock);
    if (isEmptyClockRange(start, endClock) || (!wasOvernight && endsNextDay(start, endClock))) {
      setEndTime(null);
    }
  };

  const handleEndTimeChange = (selectedTime: Date) => {
    setEndTime(selectedTime);
  };

  const resetForm = () => {
    const start = nextRoundHour(wallClockIn(timezone));
    setDate(start);
    setStartTime(start);
    setEndTime(null);
    setLocation('');
  };

  // A rehearsal that exists stays in its project — the server has no move —
  // and picking the project already shown changes nothing (review R9-01). Only
  // a real switch starts the participants over, for the project switched to.
  const handleSelectProject = (project: Project) => {
    setShowProjectPicker(false);
    if (isEditMode || project.id === localSelectedProject?.id) return;
    setLocalSelectedProject(project);
    setSelectedProject(project); // Also update global context
    setParticipants({ projectId: project.id, ids: [], settled: false });
  };

  const handleCreateProject = async () => {
    setShowProjectPicker(false);

    // Anyone can create a project: the paid tier was taken out of the app for
    // the App Store release — see docs/app-store-release.md. CreateProject is
    // on the app stack, beside this form; the Projects tab has no such screen,
    // and asking it for one did nothing (review R9-03).
    navigation.navigate('CreateProject');
  };

  return {
    // Computed values
    adminProjects,
    defaultProject,
    // Form state
    date,
    setDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    /** The end is on the day after `date`. */
    endsNextDay: endsNextDay(startClock, endClock),
    title,
    setTitle,
    location,
    setLocation,
    localSelectedProject,
    setLocalSelectedProject,
    selectedMemberIds,
    setSelectedMemberIds,
    startParticipants,
    participantsSettled: participants.settled && participants.projectId === localSelectedProject?.id,
    // UI state
    showDatePicker,
    setShowDatePicker,
    showStartTimePicker,
    setShowStartTimePicker,
    showEndTimePicker,
    setShowEndTimePicker,
    showProjectPicker,
    setShowProjectPicker,
    // Handlers
    handleTimeSelect,
    openDatePicker,
    openStartTimePicker,
    openEndTimePicker,
    handleDateChange,
    handleStartTimeChange,
    handleEndTimeChange,
    resetForm,
    handleSelectProject,
    handleCreateProject,
    // Edit mode state
    isEditMode,
    loadingRehearsal,
    rehearsalId: routeParams?.rehearsalId,
  };
}
