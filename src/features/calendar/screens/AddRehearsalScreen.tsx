import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { AppStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { rehearsalsAPI, projectsAPI } from '../../../shared/services/api';
import { Project, ProjectMember } from '../../../shared/types';
import { ActorSelector } from '../components/ActorSelector';
import { TimeRecommendations } from '../components/TimeRecommendations';
import { TimeRange } from '../../../shared/utils/availability';
import { checkSchedulingConflicts, formatConflictMessage } from '../../../shared/utils/conflictDetection';
import { dateTimeToISO } from '../../../shared/utils/time';
import { addRehearsalScreenStyles as styles } from '../styles';
import { getSyncSettings } from '../../../shared/utils/calendarStorage';
import { syncRehearsalToCalendar } from '../../../shared/services/calendarSync';

type NavigationType = NativeStackNavigationProp<AppStackParamList>;
type RouteType = RouteProp<AppStackParamList, 'AddRehearsal'>;

export default function AddRehearsalScreen() {
  const navigation = useNavigation<NavigationType>();
  const route = useRoute<RouteType>();
  const { projects, selectedProject, setSelectedProject } = useProjects();
  const { t, language } = useI18n();

  // Get route params
  const { projectId: prefilledProjectId, prefilledDate, prefilledTime, prefilledEndTime } = route.params || {};

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

  // Form state
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return end;
  });
  const [location, setLocation] = useState('');
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(
    selectedProject?.is_admin ? selectedProject : null
  );
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberAvailability, setMemberAvailability] = useState<Record<string, { timeRanges: TimeRange[] }>>({});

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

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
      const [hours, minutes] = prefilledTime.split(':').map(Number);
      const timeDate = new Date();
      timeDate.setHours(hours, minutes, 0, 0);
      setStartTime(timeDate);
    }

    if (prefilledEndTime) {
      const [hours, minutes] = prefilledEndTime.split(':').map(Number);
      const timeDate = new Date();
      timeDate.setHours(hours, minutes, 0, 0);
      setEndTime(timeDate);
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

  // Load members when project changes
  useEffect(() => {
    const loadMembers = async () => {
      if (!localSelectedProject) {
        setMembers([]);
        setSelectedMemberIds([]);
        return;
      }

      setLoadingMembers(true);
      try {
        const response = await projectsAPI.getMembers(localSelectedProject.id);
        setMembers(response.data.members || []);
      } catch (error) {
        console.error('Failed to load members:', error);
        Alert.alert(t.common.error, t.rehearsals.loadMembersError);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [localSelectedProject]);

  // Load availability when date or members change
  useEffect(() => {
    const loadAvailability = async () => {
      console.log('[DEBUG] loadAvailability called', {
        hasProject: !!localSelectedProject,
        memberCount: selectedMemberIds.length,
        projectId: localSelectedProject?.id,
        memberIds: selectedMemberIds,
      });

      if (!localSelectedProject || selectedMemberIds.length === 0) {
        console.log('[DEBUG] Skipping - no project or members');
        setMemberAvailability({});
        return;
      }

      setLoadingAvailability(true);
      try {
        const dateStr = date.toISOString().split('T')[0];
        console.log('[DEBUG] Calling API with:', { projectId: localSelectedProject.id, dateStr, memberIds: selectedMemberIds });

        const response = await projectsAPI.getMembersAvailability(
          localSelectedProject.id,
          dateStr,
          selectedMemberIds
        );

        console.log('[DEBUG] API response:', response.data);

        // Transform array response to Record<userId, {timeRanges}>
        const availabilityMap: Record<string, { timeRanges: TimeRange[] }> = {};
        const availabilityArray = response.data.availability || [];

        for (const userAvail of availabilityArray) {
          // Find the data for the current date
          const dateData = userAvail.dates?.find((d: any) => d.date === dateStr);
          if (dateData && dateData.timeRanges) {
            availabilityMap[userAvail.userId] = {
              timeRanges: dateData.timeRanges
            };
          }
        }

        console.log('[DEBUG] Transformed availability:', availabilityMap);
        setMemberAvailability(availabilityMap);
      } catch (error: any) {
        console.error('[DEBUG] Failed to load availability:', error);
        console.error('[DEBUG] Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        Alert.alert(t.common.error, t.rehearsals.loadAvailabilityError);
        setMemberAvailability({});
      } finally {
        setLoadingAvailability(false);
      }
    };

    loadAvailability();
  }, [localSelectedProject, date, selectedMemberIds]);

  const handleTimeSelect = (startTime: string, endTime: string) => {
    // Parse HH:MM format and create Date objects with today's date
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const newStartTime = new Date(date);
    newStartTime.setHours(startHours, startMinutes, 0, 0);

    const newEndTime = new Date(date);
    newEndTime.setHours(endHours, endMinutes, 0, 0);

    setStartTime(newStartTime);
    setEndTime(newEndTime);
  };

  const formatDate = (d: Date) => {
    return d.toISOString().split('T')[0];
  };

  const formatTime = (d: Date) => {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDisplayDate = (d: Date) => {
    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const openDatePicker = () => {
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
    setShowDatePicker(true);
  };

  const openStartTimePicker = () => {
    setShowDatePicker(false);
    setShowEndTimePicker(false);
    setShowStartTimePicker(true);
  };

  const openEndTimePicker = () => {
    setShowDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleStartTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }
    if (selectedTime) {
      setStartTime(selectedTime);
      // Auto-adjust end time if it's before start time
      if (selectedTime >= endTime) {
        const newEnd = new Date(selectedTime);
        newEnd.setHours(newEnd.getHours() + 2);
        setEndTime(newEnd);
      }
    }
  };

  const handleEndTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndTimePicker(false);
    }
    if (selectedTime) {
      setEndTime(selectedTime);
    }
  };

  const resetForm = () => {
    setDate(new Date());
    setStartTime(new Date());
    const end = new Date();
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

  const handleCreateProject = () => {
    setShowProjectPicker(false);
    navigation.navigate('CreateProject');
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
              onPress: () => createRehearsal(),
            },
          ]
        );
        return;
      }
    }

    // No conflicts, create rehearsal
    createRehearsal();
  };

  const createRehearsal = async () => {
    if (!localSelectedProject) {
      Alert.alert(t.common.error, t.rehearsals.projectNotSelected);
      return;
    }

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

      const response = await rehearsalsAPI.create(localSelectedProject.id, rehearsalData);
      const createdRehearsal = response.data;

      // Auto-sync to calendar if export is enabled
      try {
        const syncSettings = await getSyncSettings();
        if (syncSettings.exportEnabled && syncSettings.exportCalendarId && createdRehearsal?.id) {
          const rehearsalWithProject = {
            id: createdRehearsal.id,
            projectId: localSelectedProject.id,
            projectName: localSelectedProject.name,
            startsAt: rehearsalData.startsAt,
            endsAt: rehearsalData.endsAt,
            location: rehearsalData.location,
          };

          await syncRehearsalToCalendar(rehearsalWithProject, syncSettings.exportCalendarId);
          console.log('[AddRehearsal] Auto-synced rehearsal to calendar');
        }
      } catch (syncError) {
        // Don't fail the whole operation if sync fails, just log it
        console.error('[AddRehearsal] Failed to auto-sync to calendar:', syncError);
      }

      Alert.alert(
        t.rehearsals.success,
        t.rehearsals.rehearsalCreated,
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
      console.error('Failed to create rehearsal:', error);
      Alert.alert(
        t.common.error,
        error.response?.data?.error || error.message || t.rehearsals.createError
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t.rehearsals.addRehearsal}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Project Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.project}</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowProjectPicker(true)}
            >
              <Ionicons name="folder-outline" size={20} color={Colors.accent.purple} />
              <Text style={[
                styles.pickerButtonText,
                !localSelectedProject && styles.placeholderText
              ]}>
                {localSelectedProject?.name || t.rehearsals.selectProject}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.text.tertiary} style={styles.chevronIcon} />
            </TouchableOpacity>
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.date}</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={openDatePicker}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatDisplayDate(date)}</Text>
            </TouchableOpacity>
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
                style={styles.pickerOverlay}
              >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    locale={language === 'ru' ? 'ru-RU' : 'en-US'}
                    themeVariant="dark"
                    textColor={Colors.text.primary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
                locale={language === 'ru' ? 'ru-RU' : 'en-US'}
                themeVariant="dark"
                textColor={Colors.text.primary}
              />
            )}
          </View>

          {/* Participants */}
          {localSelectedProject && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.rehearsals.participants}</Text>
              <ActorSelector
                members={members}
                selectedMemberIds={selectedMemberIds}
                onSelectionChange={setSelectedMemberIds}
                loading={loadingMembers}
                date={formatDate(date)}
                memberAvailability={memberAvailability}
              />
            </View>
          )}

          {/* Time Recommendations */}
          {localSelectedProject && selectedMemberIds.length > 0 && (
            <TimeRecommendations
              selectedDate={formatDate(date)}
              selectedMembers={members.filter(m => selectedMemberIds.includes(m.userId))}
              memberAvailability={memberAvailability}
              onTimeSelect={handleTimeSelect}
              loading={loadingAvailability}
            />
          )}

          {/* Start Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.startTime}</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={openStartTimePicker}
            >
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
            {showStartTimePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setShowStartTimePicker(false)}
                style={styles.pickerOverlay}
              >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    display="spinner"
                    onChange={handleStartTimeChange}
                    is24Hour={true}
                    themeVariant="dark"
                    textColor={Colors.text.primary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            {showStartTimePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="default"
                onChange={handleStartTimeChange}
                is24Hour={true}
                themeVariant="dark"
                textColor={Colors.text.primary}
              />
            )}
          </View>

          {/* End Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.endTime}</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={openEndTimePicker}
            >
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatTime(endTime)}</Text>
            </TouchableOpacity>
            {showEndTimePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setShowEndTimePicker(false)}
                style={styles.pickerOverlay}
              >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <DateTimePicker
                    value={endTime}
                    mode="time"
                    display="spinner"
                    onChange={handleEndTimeChange}
                    is24Hour={true}
                    themeVariant="dark"
                    textColor={Colors.text.primary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            {showEndTimePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="default"
                onChange={handleEndTimeChange}
                is24Hour={true}
                themeVariant="dark"
                textColor={Colors.text.primary}
              />
            )}
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.location}</Text>
            <View style={styles.locationInputContainer}>
              <Ionicons name="location-outline" size={20} color={Colors.accent.purple} style={styles.locationIcon} />
              <TextInput
                style={styles.locationInput}
                value={location}
                onChangeText={setLocation}
                placeholder={t.rehearsals.locationPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>{t.rehearsals.createRehearsal}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Project Picker Modal */}
      <Modal
        visible={showProjectPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProjectPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProjectPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.rehearsals.selectProject}</Text>
              <TouchableOpacity onPress={() => setShowProjectPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {adminProjects.length === 0 ? (
              <View style={styles.emptyProjectsContainer}>
                <Ionicons name="folder-open-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyProjectsText}>
                  {projects.length === 0
                    ? t.rehearsals.noProjects
                    : t.rehearsals.noAdminProjects}
                </Text>
              </View>
            ) : (
              <FlatList
                data={adminProjects}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.projectItem,
                      localSelectedProject?.id === item.id && styles.projectItemSelected,
                    ]}
                    onPress={() => handleSelectProject(item)}
                  >
                    <View style={styles.projectItemLeft}>
                      <Text style={[
                        styles.projectItemName,
                        localSelectedProject?.id === item.id && styles.projectItemNameSelected,
                      ]}>
                        {item.name}
                      </Text>
                      {item.description && (
                        <Text style={styles.projectItemDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {localSelectedProject?.id === item.id && (
                      <Ionicons name="checkmark" size={20} color={Colors.accent.purple} />
                    )}
                  </TouchableOpacity>
                )}
                style={styles.projectList}
              />
            )}

            {/* Create Project Button */}
            <TouchableOpacity
              style={styles.createProjectButton}
              onPress={handleCreateProject}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.createProjectButtonText}>{t.rehearsals.createNewProject}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
