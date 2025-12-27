import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { AppStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { ActorSelector } from '../components/ActorSelector';
import { TimeRecommendations } from '../components/TimeRecommendations';
import { addRehearsalScreenStyles as styles } from '../styles';
import {
  useRehearsalMembers,
  useRehearsalAvailability,
  useAddRehearsalForm,
  useAddRehearsalSubmit,
} from '../hooks';
import { formatDate, formatTime, formatDisplayDate } from '../utils/rehearsalFormatters';

type RouteType = RouteProp<AppStackParamList, 'AddRehearsal'>;

export default function AddRehearsalScreen() {
  const route = useRoute<RouteType>();
  const { projects, selectedProject, setSelectedProject } = useProjects();
  const { t, language } = useI18n();

  // Form management hook
  const form = useAddRehearsalForm({
    projects,
    selectedProject,
    setSelectedProject,
    routeParams: route.params,
  });

  // Data loading hooks
  const { members, loading: loadingMembers } = useRehearsalMembers(form.localSelectedProject, t);
  const { memberAvailability, loading: loadingAvailability } = useRehearsalAvailability(
    form.localSelectedProject,
    form.date,
    form.selectedMemberIds,
    t
  );

  // Submit logic hook
  const { loading, handleSubmit } = useAddRehearsalSubmit({
    localSelectedProject: form.localSelectedProject,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    location: form.location,
    selectedMemberIds: form.selectedMemberIds,
    members,
    memberAvailability,
    resetForm: form.resetForm,
    t,
  });

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
              onPress={() => form.setShowProjectPicker(true)}
            >
              <Ionicons name="folder-outline" size={20} color={Colors.accent.purple} />
              <Text style={[
                styles.pickerButtonText,
                !form.localSelectedProject && styles.placeholderText
              ]}>
                {form.localSelectedProject?.name || t.rehearsals.selectProject}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.text.tertiary} style={styles.chevronIcon} />
            </TouchableOpacity>
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.date}</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={form.openDatePicker}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatDisplayDate(form.date, language)}</Text>
            </TouchableOpacity>
            {form.showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => form.setShowDatePicker(false)}
                style={styles.pickerOverlay}
              >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <DateTimePicker
                    value={form.date}
                    mode="date"
                    display="spinner"
                    onChange={form.handleDateChange}
                    locale={language === 'ru' ? 'ru-RU' : 'en-US'}
                    themeVariant="dark"
                    textColor={Colors.text.primary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            {form.showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={form.date}
                mode="date"
                display="default"
                onChange={form.handleDateChange}
                locale={language === 'ru' ? 'ru-RU' : 'en-US'}
                themeVariant="dark"
                textColor={Colors.text.primary}
              />
            )}
          </View>

          {/* Participants */}
          {form.localSelectedProject && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.rehearsals.participants}</Text>
              <ActorSelector
                members={members}
                selectedMemberIds={form.selectedMemberIds}
                onSelectionChange={form.setSelectedMemberIds}
                loading={loadingMembers}
                date={formatDate(form.date)}
                memberAvailability={memberAvailability}
              />
            </View>
          )}

          {/* Time Recommendations */}
          {form.localSelectedProject && form.selectedMemberIds.length > 0 && (
            <TimeRecommendations
              selectedDate={formatDate(form.date)}
              selectedMembers={members.filter(m => form.selectedMemberIds.includes(m.userId))}
              memberAvailability={memberAvailability}
              onTimeSelect={form.handleTimeSelect}
              loading={loadingAvailability}
            />
          )}

          {/* Start Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.startTime}</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={form.openStartTimePicker}
            >
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatTime(form.startTime)}</Text>
            </TouchableOpacity>
            {form.showStartTimePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => form.setShowStartTimePicker(false)}
                style={styles.pickerOverlay}
              >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <DateTimePicker
                    value={form.startTime}
                    mode="time"
                    display="spinner"
                    onChange={form.handleStartTimeChange}
                    is24Hour={true}
                    themeVariant="dark"
                    textColor={Colors.text.primary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            {form.showStartTimePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={form.startTime}
                mode="time"
                display="default"
                onChange={form.handleStartTimeChange}
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
              onPress={form.openEndTimePicker}
            >
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatTime(form.endTime)}</Text>
            </TouchableOpacity>
            {form.showEndTimePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => form.setShowEndTimePicker(false)}
                style={styles.pickerOverlay}
              >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <DateTimePicker
                    value={form.endTime}
                    mode="time"
                    display="spinner"
                    onChange={form.handleEndTimeChange}
                    is24Hour={true}
                    themeVariant="dark"
                    textColor={Colors.text.primary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            {form.showEndTimePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={form.endTime}
                mode="time"
                display="default"
                onChange={form.handleEndTimeChange}
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
                value={form.location}
                onChangeText={form.setLocation}
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
        visible={form.showProjectPicker}
        transparent
        animationType="slide"
        onRequestClose={() => form.setShowProjectPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => form.setShowProjectPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.rehearsals.selectProject}</Text>
              <TouchableOpacity onPress={() => form.setShowProjectPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {form.adminProjects.length === 0 ? (
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
                data={form.adminProjects}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.projectItem,
                      form.localSelectedProject?.id === item.id && styles.projectItemSelected,
                    ]}
                    onPress={() => form.handleSelectProject(item)}
                  >
                    <View style={styles.projectItemLeft}>
                      <Text style={[
                        styles.projectItemName,
                        form.localSelectedProject?.id === item.id && styles.projectItemNameSelected,
                      ]}>
                        {item.name}
                      </Text>
                      {item.description && (
                        <Text style={styles.projectItemDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {form.localSelectedProject?.id === item.id && (
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
              onPress={form.handleCreateProject}
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
