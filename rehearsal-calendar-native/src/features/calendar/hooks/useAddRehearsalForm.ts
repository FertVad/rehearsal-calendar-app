import { useState, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../../navigation';
import { Project } from '../../../shared/types';
import { parseTimeString } from '../../../shared/utils/time';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useI18n } from '../../../contexts/I18nContext';

type NavigationType = NativeStackNavigationProp<AppStackParamList>;

interface RouteParams {
  projectId?: string;
  rehearsalId?: string;
  prefilledDate?: string;
  prefilledTime?: string;
  prefilledEndTime?: string;
}

interface UseAddRehearsalFormProps {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  routeParams?: RouteParams;
}

// Helper function to set minutes to 00 (round hours)
const setMinutesToZero = (date: Date): Date => {
  const rounded = new Date(date);
  rounded.setMinutes(0, 0, 0);
  return rounded;
};

export function useAddRehearsalForm({
  projects,
  selectedProject,
  setSelectedProject,
  routeParams,
}: UseAddRehearsalFormProps) {
  const navigation = useNavigation<NavigationType>();
  const { language, t } = useI18n();

  // Extract route params
  const { projectId: prefilledProjectId, prefilledDate, prefilledTime, prefilledEndTime } = routeParams || {};

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

  // Form state - set minutes to 00 for better UX
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(() => setMinutesToZero(new Date()));
  const [endTime, setEndTime] = useState(() => {
    const start = setMinutesToZero(new Date());
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    return end;
  });
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(
    selectedProject?.is_admin ? selectedProject : null
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // UI state - separate state for each modal picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
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

    if (prefilledDate) {
      const parsedDate = new Date(prefilledDate + 'T00:00:00');
      setDate(parsedDate);
    }

    if (prefilledTime) {
      setStartTime(parseTimeString(prefilledTime));
    }

    if (prefilledEndTime) {
      setEndTime(parseTimeString(prefilledEndTime));
    }
  }, [prefilledProjectId, prefilledDate, prefilledTime, prefilledEndTime, projects]);

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
      setIsEditMode(true);

      try {
        // By id, not from the calendar batch: the batch is the caller's own
        // calendar, so an admin who was not on a rehearsal could not open it
        // for editing at all (review D04).
        const rehearsalResponse = await rehearsalsAPI.getById(String(rehearsalId));
        const rehearsal = rehearsalResponse.data.rehearsal;

        // Prefill form fields
        const startsAt = new Date(rehearsal.startsAt);
        const endsAt = new Date(rehearsal.endsAt);

        setDate(startsAt);
        setStartTime(startsAt);
        setEndTime(endsAt);
        setTitle(rehearsal.title || '');
        setLocation(rehearsal.location || '');

        // The roster as the server reads it: the people on the rehearsal who are
        // still in the project, whatever their answer — 'no' means invited and
        // not yet seen, and leaving them unselected would drop them on save.
        const responsesResponse = await rehearsalsAPI.getResponses(String(rehearsalId));
        const participants = responsesResponse.data.allParticipants || [];
        setSelectedMemberIds(participants.map((p: any) => String(p.userId)));
      } catch (error: any) {
        // An edit sends the whole participant list, and an empty one clears the
        // call. A form left open over a failed load could save exactly that
        // (review DF03), so a form that could not load closes.
        console.error('Failed to load rehearsal:', error);
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
  const handleTimeSelect = (startTime: string, endTime: string) => {
    setStartTime(parseTimeString(startTime, date));
    setEndTime(parseTimeString(endTime, date));
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

  const handleStartTimeChange = (selectedTime: Date) => {
    setStartTime(selectedTime);
    // Auto-adjust end time if it's before start time
    if (selectedTime >= endTime) {
      const newEnd = new Date(selectedTime);
      newEnd.setHours(newEnd.getHours() + 2);
      setEndTime(newEnd);
    }
  };

  const handleEndTimeChange = (selectedTime: Date) => {
    setEndTime(selectedTime);
  };

  const resetForm = () => {
    setDate(new Date());
    const start = setMinutesToZero(new Date());
    setStartTime(start);
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    setEndTime(end);
    setLocation('');
  };

  const handleSelectProject = (project: Project) => {
    setLocalSelectedProject(project);
    setSelectedProject(project); // Also update global context
    setSelectedMemberIds([]); // Reset selection when changing project
    setShowProjectPicker(false);
  };

  const handleCreateProject = async () => {
    setShowProjectPicker(false);

    // Anyone can create a project: the paid tier was taken out of the app for
  // the App Store release — see docs/app-store-release.md
    // @ts-ignore - Navigate to Projects tab -> CreateProject screen
    navigation.navigate('Projects', { screen: 'CreateProject' });
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
    title,
    setTitle,
    location,
    setLocation,
    localSelectedProject,
    setLocalSelectedProject,
    selectedMemberIds,
    setSelectedMemberIds,
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
