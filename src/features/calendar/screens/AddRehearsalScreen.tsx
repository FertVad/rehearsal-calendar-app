import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { AppStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { rehearsalsAPI, projectsAPI } from '../../../shared/services/api';
import { Project, ProjectMember } from '../../../shared/types';
import { ActorSelector } from '../components/ActorSelector';
import { TimeRecommendations } from '../components/TimeRecommendations';
import { TimeRange } from '../../../shared/utils/availability';
import { addRehearsalScreenStyles as styles } from '../styles';

type NavigationType = NativeStackNavigationProp<AppStackParamList>;

export default function AddRehearsalScreen() {
  const navigation = useNavigation<NavigationType>();
  const { projects, selectedProject, setSelectedProject } = useProjects();

  // Form state
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return end;
  });
  const [location, setLocation] = useState('');
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(selectedProject);
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
        Alert.alert('Ошибка', 'Не удалось загрузить участников проекта');
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [localSelectedProject]);

  // Load availability when date or members change
  useEffect(() => {
    const loadAvailability = async () => {
      if (!localSelectedProject) {
        setMemberAvailability({});
        return;
      }

      setLoadingAvailability(true);
      try {
        // Since backend endpoint doesn't exist yet, initialize with empty object for each member
        const availability: Record<string, { timeRanges: TimeRange[] }> = {};
        selectedMemberIds.forEach(memberId => {
          availability[memberId] = { timeRanges: [] };
        });
        setMemberAvailability(availability);
      } catch (error) {
        console.error('Failed to load availability:', error);
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
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDisplayDate = (d: Date) => {
    return d.toLocaleDateString('ru-RU', {
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
      Alert.alert('Ошибка', 'Выберите проект для создания репетиции');
      return;
    }

    if (endTime <= startTime) {
      Alert.alert('Ошибка', 'Время окончания должно быть позже времени начала');
      return;
    }

    setLoading(true);

    try {
      const rehearsalData = {
        date: formatDate(date),
        time: formatTime(startTime),
        end_time: formatTime(endTime),
        location: location.trim() || undefined,
        participant_ids: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      };

      await rehearsalsAPI.create(localSelectedProject.id, rehearsalData);

      Alert.alert(
        'Успешно',
        'Репетиция создана',
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
        'Ошибка',
        error.response?.data?.error || error.message || 'Не удалось создать репетицию'
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
          <Text style={styles.title}>Добавить репетицию</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Project Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Проект</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowProjectPicker(true)}
            >
              <Ionicons name="folder-outline" size={20} color={Colors.accent.purple} />
              <Text style={[
                styles.pickerButtonText,
                !localSelectedProject && styles.placeholderText
              ]}>
                {localSelectedProject?.name || 'Выберите проект'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.text.tertiary} style={styles.chevronIcon} />
            </TouchableOpacity>
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Дата</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={openDatePicker}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatDisplayDate(date)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                locale="ru-RU"
                themeVariant="dark"
                textColor={Colors.text.primary}
              />
            )}
          </View>

          {/* Participants */}
          {localSelectedProject && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Участники</Text>
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
            <Text style={styles.label}>Время начала</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={openStartTimePicker}
            >
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
            {showStartTimePicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleStartTimeChange}
                is24Hour={true}
                themeVariant="dark"
                textColor={Colors.text.primary}
              />
            )}
          </View>

          {/* End Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Время окончания</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={openEndTimePicker}
            >
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatTime(endTime)}</Text>
            </TouchableOpacity>
            {showEndTimePicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleEndTimeChange}
                is24Hour={true}
                themeVariant="dark"
                textColor={Colors.text.primary}
              />
            )}
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Место</Text>
            <View style={styles.locationInputContainer}>
              <Ionicons name="location-outline" size={20} color={Colors.accent.purple} style={styles.locationIcon} />
              <TextInput
                style={styles.locationInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Адрес или название места"
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
                <Text style={styles.submitButtonText}>Создать репетицию</Text>
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
              <Text style={styles.modalTitle}>Выберите проект</Text>
              <TouchableOpacity onPress={() => setShowProjectPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {projects.length === 0 ? (
              <View style={styles.emptyProjectsContainer}>
                <Ionicons name="folder-open-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyProjectsText}>Нет проектов</Text>
              </View>
            ) : (
              <FlatList
                data={projects}
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
              <Text style={styles.createProjectButtonText}>Создать новый проект</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
