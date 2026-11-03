import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { hapticMedium, hapticSuccess } from '../../../shared/utils/haptics';
import type { AppStackParamList, AppNavigation } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { ParticipantPicker, busyText } from '../../../shared/components/ParticipantPicker';
import { IconButton } from '../../../shared/components/IconButton';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { checkSchedulingConflicts } from '../../../shared/utils/conflictDetection';
import { TimeRecommendations } from '../components/TimeRecommendations';
import { PickerModal } from '../../../shared/components/PickerModal';
import { DayCalendar } from '../../../shared/components/DayCalendar';
import { AppModal } from '../../../shared/components/AppModal';
import { ModalSheet } from '../../../shared/components/ModalSheet';
import { BottomActionBar, BottomActionButton } from '../../../shared/components/BottomActionBar';
import { useParticipantSeed } from '../hooks/useParticipantSeed';
import { useLeaveGuard } from '../../../shared/hooks/useLeaveGuard';
import { addRehearsalScreenStyles as styles } from '../styles';
import {
  useRehearsalMembers,
  useRehearsalAvailability,
  useAddRehearsalForm,
  useAddRehearsalSubmit,
} from '../hooks';
import { formatDisplayDate } from '../utils/rehearsalFormatters';
import { formatDateToString, formatDateToTimeString, parseDateString } from '../../../shared/utils/time';
import { formatClock, formatTimeRange, usePhoneUses24HourClock } from '../../../shared/utils/clockFormat';

type RouteType = RouteProp<AppStackParamList, 'AddRehearsal'>;

/** What stops a save, under the field it is about (T-018). */
function FieldError({ message, testID }: { message?: string; testID: string }) {
  return message ? <Text testID={testID} style={styles.fieldError}>{message}</Text> : null;
}

export default function AddRehearsalScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<AppNavigation<'AddRehearsal'>>();
  const { projects, selectedProject, setSelectedProject } = useProjects();
  const { t, language } = useI18n();
  const uses24 = usePhoneUses24HourClock();

  // Form management hook
  const form = useAddRehearsalForm({
    projects,
    selectedProject,
    setSelectedProject,
    routeParams: route.params,
  });

  // Data loading hooks
  const membersLoad = useRehearsalMembers(form.localSelectedProject);
  const { members, loading: loadingMembers } = membersLoad;
  const availabilityLoad = useRehearsalAvailability(
    form.localSelectedProject,
    form.date,
    form.selectedMemberIds,
    t,
    form.isEditMode ? form.rehearsalId : undefined,
    form.endsNextDay
  );
  const { memberAvailability, loading: loadingAvailability } = availabilityLoad;

  // Submit logic hook
  const { handleSubmit, canSubmit, issues } = useAddRehearsalSubmit({
    localSelectedProject: form.localSelectedProject,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    title: form.title,
    location: form.location,
    selectedMemberIds: form.selectedMemberIds,
    participantsSettled: form.participantsSettled,
    membersFailed: membersLoad.failed,
    reloadMembers: membersLoad.reload,
    members,
    memberAvailability,
    availabilityReady: availabilityLoad.ready,
    availabilityFailed: availabilityLoad.failed,
    reloadAvailability: availabilityLoad.reload,
    resetForm: form.resetForm,
    fields: form.fields,
    markSaved: form.markSaved,
    t,
    isEditMode: form.isEditMode,
    rehearsalId: form.rehearsalId,
  });

  // Closing with something changed and not saved asks first, however it is
  // closed (T-013); saved from there, the form closes once the save is in.
  // Create goes through it too, and while a save is out the form takes no
  // edits (review T-013 r2).
  const guard = useLeaveGuard({
    hasChanges: form.hasChanges,
    canSave: canSubmit,
    save: (leaving) => handleSubmit(leaving),
  });
  const saving = guard.saving;

  // Who a new rehearsal starts with: the planner's people, or everyone (DP02).
  const memberIds = useMemo(() => members.map(m => m.userId), [members]);
  useParticipantSeed({
    isEditMode: form.isEditMode,
    projectId: form.localSelectedProject?.id,
    memberIds,
    membersReady: membersLoad.ready,
    participantsSettled: form.participantsSettled,
    plannedProjectId: route.params?.projectId,
    plannedMemberIds: route.params?.prefilledMemberIds,
    startParticipants: form.startParticipants,
  });

  // The participants row and its sheet: who is busy on the day, and whether
  // anyone picked is busy at the rehearsal's time — by the same check as the
  // warning on save, once the day's availability is in.
  const people = useMemo(() => members.map(m => ({
    id: m.userId,
    name: `${m.firstName}${m.lastName ? ' ' + m.lastName : ''}`,
    isAdmin: m.role === 'owner' || m.role === 'admin',
    busy: busyText(memberAvailability[m.userId]?.timeRanges, t, getDateLocale(language), uses24),
  })), [members, memberAvailability, t, language, uses24]);
  const conflict = useMemo(() => {
    if (!availabilityLoad.ready || form.selectedMemberIds.length === 0) return undefined;
    const { busyMembers } = checkSchedulingConflicts(
      members.filter(m => form.selectedMemberIds.includes(m.userId)),
      memberAvailability,
      formatDateToTimeString(form.startTime),
      formatDateToTimeString(form.endTime),
    );
    if (busyMembers.length === 0) return undefined;
    const [{ member, conflictingSlots: [slot] }] = busyMembers;
    const line = t.rehearsals.busyAt(member.lastName || member.firstName, formatTimeRange(slot.start, slot.end, getDateLocale(language), uses24));
    return busyMembers.length > 1 ? `${line} ${t.rehearsals.andMore(busyMembers.length - 1)}` : line;
  }, [availabilityLoad.ready, members, form.selectedMemberIds, memberAvailability, form.startTime, form.endTime, t, language, uses24]);

  // A project whose members could not be loaded says so, with a way to try
  // again; until then nothing is saved (useAddRehearsalSubmit).
  useEffect(() => {
    if (!membersLoad.failed) return;
    Alert.alert(t.common.error, t.rehearsals.loadMembersError, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.retry, onPress: membersLoad.reload },
    ]);
  }, [membersLoad.failed]);

  return (
    // While a save is out nothing here takes a tap (useLeaveGuard).
    <View style={styles.container} pointerEvents={saving ? 'none' : 'auto'}>
      {/* Create is in the bar below, which keeps it over the keyboard; it
          was at the end of this list, and typing the location hid it. */}
      <SafeAreaView style={styles.scrollView}>
        {/* The screen is a modal whose body is a full-height ScrollView, so the
            swipe-down dismiss gesture is swallowed by the list. Without Cancel
            the only way out is creating the rehearsal; with changes it asks
            first, as the swipe does (useLeaveGuard). Create is in the bar
            below, not up here (T-009). */}
        <ScreenHeader
          kind="modal"
          title={form.isEditMode ? t.rehearsals.editRehearsal : t.rehearsals.addRehearsal}
          cancelLabel={t.common.cancel}
          onCancel={() => {
            Keyboard.dismiss();
            navigation.goBack();
          }}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
        {/* Loading indicator for edit mode */}
        {form.loadingRehearsal && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.accent.purple} />
            <Text style={{ marginTop: 10, color: Colors.text.primary }}>
              {t.common.loading}
            </Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          {/* Project Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.project}</Text>
            <TouchableOpacity
              testID="rehearsal-project"
              style={styles.pickerButton}
              onPress={() => form.setShowProjectPicker(true)}
              // A rehearsal that exists stays in its project (review R9-01).
              disabled={form.isEditMode}
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
            <FieldError testID="rehearsal-project-error" message={issues.project} />
          </View>

          {/* Title — optional; a rehearsal identified by time and venue alone
              is a perfectly normal entry, so this must never block submission. */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.rehearsalTitle} {t.auth.optional}</Text>
            <View style={styles.locationInputContainer}>
              <Ionicons name="text-outline" size={20} color={Colors.accent.purple} style={styles.locationIcon} />
              <TextInput
                style={styles.locationInput}
                value={form.title}
                onChangeText={form.setTitle}
                editable={!saving}
                placeholder={t.rehearsals.rehearsalTitlePlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                blurOnSubmit={true}
              />
            </View>
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.date}</Text>
            <TouchableOpacity
              testID="rehearsal-date"
              style={styles.pickerButton}
              onPress={form.toggleDatePicker}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatDisplayDate(form.date, language)}</Text>
              <Ionicons name={form.showDatePicker ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.text.tertiary} style={styles.chevronIcon} />
            </TouchableOpacity>
            {/* The month, in the form: wheels for a date gave no sense of the
                week (T-018). Days before today take no tap, but the edited
                rehearsal's own. */}
            {form.showDatePicker && (
              <View style={styles.calendarBox}>
                <DayCalendar
                  testID="rehearsal-date-calendar"
                  value={formatDateToString(form.date)}
                  allowedPast={form.savedDate}
                  onChange={(day) => form.handleDateChange(parseDateString(day))}
                />
              </View>
            )}
          </View>

          {/* Participants */}
          {form.localSelectedProject && (
            <View style={styles.inputGroup}>
              <ParticipantPicker
                people={people}
                selectedIds={form.selectedMemberIds}
                onChange={form.setSelectedMemberIds}
                loading={loadingMembers}
                conflict={conflict}
              />
              {issues.participants && (
                <View style={styles.fieldNoteRow}>
                  <Text
                    testID="rehearsal-participants-note"
                    style={[styles.fieldNote, issues.participants.failed && styles.fieldError]}
                  >
                    {issues.participants.text}
                  </Text>
                  {issues.participants.retry && (
                    <TouchableOpacity
                      testID="rehearsal-participants-retry"
                      style={styles.fieldNoteAction}
                      onPress={issues.participants.retry}
                    >
                      <Text style={styles.fieldNoteActionText}>{t.common.retry}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Time Recommendations */}
          {form.localSelectedProject && form.selectedMemberIds.length > 0 && (
            <TimeRecommendations
              selectedDate={formatDateToString(form.date)}
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
              testID="rehearsal-start-time"
              style={styles.pickerButton}
              onPress={form.openStartTimePicker}
            >
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatClock(formatDateToTimeString(form.startTime), getDateLocale(language), uses24)}</Text>
            </TouchableOpacity>
          </View>

          {/* End Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.endTime}</Text>
            <TouchableOpacity
              testID="rehearsal-end-time"
              style={styles.pickerButton}
              onPress={form.openEndTimePicker}
            >
              <Ionicons name="time-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.pickerButtonText}>{formatClock(formatDateToTimeString(form.endTime), getDateLocale(language), uses24)}</Text>
              {/* An end before the start is the next morning, and says so. */}
              {form.endsNextDay && (
                <Text style={styles.nextDayText} testID="rehearsal-ends-next-day">
                  {t.rehearsals.endsNextDay}
                </Text>
              )}
            </TouchableOpacity>
            <FieldError testID="rehearsal-end-time-error" message={issues.end} />
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.rehearsals.location}</Text>
            <View style={styles.locationInputContainer}>
              <Ionicons name="location-outline" size={20} color={Colors.accent.purple} style={styles.locationIcon} />
              <TextInput
                testID="rehearsal-location"
                style={styles.locationInput}
                value={form.location}
                onChangeText={form.setLocation}
                editable={!saving}
                placeholder={t.rehearsals.locationPlaceholder}
                placeholderTextColor={Colors.text.tertiary}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                blurOnSubmit={true}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      </SafeAreaView>

      <BottomActionBar>
        <BottomActionButton
          testID="rehearsal-submit"
          icon={form.isEditMode ? 'checkmark-circle' : 'add-circle'}
          label={form.isEditMode ? t.rehearsals.updateRehearsal : t.rehearsals.createRehearsal}
          onPress={() => {
            hapticSuccess();
            guard.save();
          }}
          // Not while something above says why it cannot be saved, and an edit
          // not before something in it is changed (T-018) - by the same mark
          // that asks before closing (T-013).
          disabled={form.loadingRehearsal || !canSubmit() || (form.isEditMode && !form.hasChanges)}
          loading={saving}
        />
      </BottomActionBar>

      {/* Start Time Picker Modal */}
      <PickerModal
        visible={form.showStartTimePicker}
        onClose={() => form.setShowStartTimePicker(false)}
        value={form.startTime}
        onConfirm={form.handleStartTimeChange}
        mode="time"
        title={t.rehearsals.selectStartTime}
        language={getDateLocale(language)}
      />

      {/* End Time Picker Modal */}
      <PickerModal
        visible={form.showEndTimePicker}
        onClose={() => form.setShowEndTimePicker(false)}
        value={form.endTime}
        onConfirm={form.handleEndTimeChange}
        mode="time"
        title={t.rehearsals.selectEndTime}
        language={getDateLocale(language)}
      />

      {/* Project Picker Modal */}
      <AppModal
        visible={form.showProjectPicker}
        animationType="slide"
        onRequestClose={() => form.setShowProjectPicker(false)}
      >
        <ModalSheet overlayStyle={styles.modalOverlay} onClose={() => form.setShowProjectPicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.rehearsals.selectProject}</Text>
              <IconButton icon="close" accessibilityLabel={t.common.close} onPress={() => form.setShowProjectPicker(false)} />
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
              onPress={() => {
                hapticMedium();
                form.handleCreateProject();
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.accent.purple} />
              <Text style={styles.createProjectButtonText}>{t.rehearsals.createNewProject}</Text>
            </TouchableOpacity>
          </View>
        </ModalSheet>
      </AppModal>
    </View>
  );
}
