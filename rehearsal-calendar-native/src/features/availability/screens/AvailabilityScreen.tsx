import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { AppNavigation } from '../../../navigation';
import { useToday } from '../../../shared/hooks/useClock';
import { endsNextDay } from '../../../shared/utils/time';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../../shared/constants/colors';
import { CalendarMonth, EditorHeader, ModeInfo } from '../components';
import { DayMode } from '../types';
import { getDayStatus, displayedMode, formatDate, generateMonths } from '../utils';
import { styles } from '../styles';
import { PANEL_HEIGHT } from '../constants';
import {
  useAvailabilityData,
  useAvailabilitySave,
  useAvailabilitySync,
  useAvailabilityEditor,
} from '../hooks';
import { useI18n } from '../../../contexts/I18nContext';
import { useAutoCalendarSync } from '../../../shared/hooks/useAutoCalendarSync';
import { PickerModal } from '../../../shared/components/PickerModal';

type AvailabilityScreenProps = {
  navigation: AppNavigation<'MarkBusy'>;
};

export default function AvailabilityScreen({ navigation }: AvailabilityScreenProps) {
  const { t, language } = useI18n();

  // Use custom hook for availability data management
  const {
    availability,
    setAvailability,
    loading,
    saving,
    setSaving,
    hasChanges,
    changed,
    markChanged,
    markSaved,
    markSettled,
    getDayState,
    loadAvailability,
    loadFailed,
  } = useAvailabilityData();

  // Save hook for validation and API submission
  const { saveAvailability } = useAvailabilitySave();

  // Sync hook for calendar sync management
  const {
    lastSyncTime,
    isSyncing,
    loadLastSyncTime,
    formatLastSync,
    performSmartSync,
    performForceSync,
  } = useAvailabilitySync();

  // Auto-sync hook for calendar import
  const { performAutoSync, forceSync } = useAutoCalendarSync();

  // The date in the profile's zone, turning at its midnight — the UTC one called
  // this evening past behind UTC and refused it (review CC01), the device's
  // disagreed with the days the hours are read into (cause fix 14).
  const today = useToday();

  const months = useMemo(() => generateMonths(7, today), [today]);

  // Editor hook for selection, validation, time picker, and slot editing
  const editor = useAvailabilityEditor({
    availability,
    setAvailability,
    markChanged,
    markSettled,
    today,
    getDayState,
    months,
  });

  const [refreshing, setRefreshing] = useState(false);
  // The past-date action applies to the past days of the selection, whichever
  // day was tapped first (review CC04).
  const selectionHasPast = editor.selectedDates.some((date) => date < today);

  // Load last sync time on mount
  useEffect(() => {
    loadLastSyncTime();
  }, [loadLastSyncTime]);

  // Auto-reload data when screen comes into focus (e.g., after calendar import)
  // Smart sync: only trigger auto-sync if 15+ minutes passed
  useFocusEffect(
    React.useCallback(() => {
      performSmartSync(performAutoSync, loadAvailability);
    }, [performSmartSync, performAutoSync, loadAvailability])
  );

  const handleSave = async () => {
    const saved = await saveAvailability({ availability, changed, today, language, t, setSaving, markSaved });
    // A slot past midnight shows on the next day as read from the server, so
    // a saved change to it is read back rather than left to the next visit.
    if (saved) loadAvailability();
    // Drop the selection so it is obvious the batch was committed; the sheet
    // stays open because marking several days in a row is the common case.
    editor.clearSelection();
  };

  // Pull-to-refresh: sync calendar + reload availability
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await performForceSync(forceSync, loadAvailability);
    } finally {
      setRefreshing(false);
    }
  };

  const selectedDayState = editor.selectedDate ? getDayState(editor.selectedDate) : null;

  // What the buttons show. Not always what was tapped: a day declared free with
  // an event already on it from the phone's calendar reads as custom hours,
  // because that event is what everyone else's planner is told about. The
  // declaration itself is untouched — `selectedDayState.mode` is what a save
  // writes, and this only decides what is drawn.
  const shownMode = displayedMode(selectedDayState ?? undefined);

  const renderMonth = ({ item }: { item: { year: number; month: number; key: string } }) => {
    return (
      <CalendarMonth
        year={item.year}
        month={item.month}
        selectedDates={editor.selectedDates}
        availability={availability}
        today={today}
        onDayPress={(y, m, d) => editor.handleDayPress(y, m, d, formatDate)}
        getDayStatus={(date) => getDayStatus(date, availability)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t.availability.title}</Text>
        {/* Only when pushed as the MarkBusy modal — the month list eats the
            swipe-down dismiss, so without this there is no way back out. As a
            tab root there is nothing to go back to and the button is hidden. */}
        {navigation.canGoBack() && (
          <TouchableOpacity
            testID="availability-close"
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t.common.cancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Nothing marked yet — say what that costs, not just that it is empty.
          Being treated as free is what actually happens, and it is the whole
          reason to fill this in. */}
      {loadFailed ? (
        <View style={styles.nothingMarked}>
          <Ionicons name="cloud-offline-outline" size={18} color={Colors.accent.yellow} />
          <Text style={styles.nothingMarkedText}>{t.availability.couldNotLoad}</Text>
        </View>
      ) : (
        Object.keys(availability).length === 0 && (
          <View style={styles.nothingMarked}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.accent.yellow} />
            <Text style={styles.nothingMarkedText}>{t.availability.nothingMarked}</Text>
          </View>
        )
      )}

      {/* Legend */}
      <View style={[
        styles.legend,
        !lastSyncTime && { justifyContent: 'center' }
      ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.lg }}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.statusDotFree]} />
            <Text style={styles.legendText}>{t.availability.free}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.statusDotPartial]} />
            <Text style={styles.legendText}>{t.availability.partial}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.statusDotBusy]} />
            <Text style={styles.legendText}>{t.availability.busy}</Text>
          </View>
        </View>

        {/* Last sync time indicator - subtle, right-aligned */}
        {lastSyncTime && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isSyncing && (
              <ActivityIndicator size="small" color={Colors.text.tertiary} style={{ marginRight: 4 }} />
            )}
            <Text style={{ fontSize: 11, color: Colors.text.tertiary }}>
              {formatLastSync(lastSyncTime, t)}
            </Text>
          </View>
        )}
      </View>

      {/* Calendar Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
          <Text style={styles.loadingText}>{t.common.loading}</Text>
        </View>
      ) : (
        <Animated.FlatList
          ref={editor.flatListRef}
          data={months}
          renderItem={renderMonth}
          keyExtractor={item => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.calendarContent,
            editor.panelOpen && { paddingBottom: PANEL_HEIGHT + Spacing.xl }
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent.purple}
            />
          }
        />
      )}

      {/* Animated Bottom Panel */}
      <Animated.View
        style={[
          styles.bottomPanel,
          {
            transform: [
              {
                translateY: editor.panelAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [PANEL_HEIGHT, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={editor.panelOpen ? 'auto' : 'none'}
      >
        {/* Handle */}
        <View style={styles.bottomSheetHandle} />

        {/* Header */}
        <EditorHeader
          selectedCount={editor.selectedDates.length}
          selectedDate={editor.selectedDate}
          onClear={editor.clearSelection}
        />

        <ScrollView style={styles.bottomSheetContent} showsVerticalScrollIndicator={false}>
          {/* Warning for past dates */}
          {selectionHasPast && (
            <View style={styles.pastDateWarning}>
              <Ionicons name="information-circle" size={20} color={Colors.accent.yellow} />
              <Text style={styles.pastDateWarningText}>
                {t.availability.pastDateWarning}
              </Text>
            </View>
          )}

          {/* Delete button for past dates */}
          {selectionHasPast && (
            <TouchableOpacity
              style={styles.deletePastDateButton}
              onPress={() => {
                Alert.alert(
                  t.availability.deleteDataConfirm,
                  t.availability.deleteDataMessage,
                  [
                    { text: t.common.cancel, style: 'cancel' },
                    {
                      text: t.common.delete,
                      style: 'destructive',
                      onPress: () =>
                        editor.deletePastDates((error) => {
                          if (error) Alert.alert(t.common.error, t.availability.saveError);
                        })
                    }
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.accent.red} />
              <Text style={styles.deletePastDateButtonText}>{t.availability.deleteData}</Text>
            </TouchableOpacity>
          )}

          {/* Mode Selection (only for future/today dates) */}
          {(!editor.selectedDate || editor.selectedDate >= today) && (
          <>
          <View style={styles.modeSelector}>
            <TouchableOpacity
              testID="mode-free"
              accessibilityState={{ selected: shownMode === 'free' }}
              style={[
                styles.modeButton,
                shownMode === 'free' && styles.modeButtonActive,
                shownMode === 'free' && styles.modeButtonFree,
              ]}
              onPress={() => editor.handleModeChange('free')}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={shownMode === 'free' ? Colors.accent.green : Colors.text.tertiary}
              />
              <Text style={[
                styles.modeButtonText,
                shownMode === 'free' && styles.modeButtonTextActive,
              ]}>
                {t.availability.free}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="mode-custom"
              accessibilityState={{ selected: shownMode === 'custom' }}
              style={[
                styles.modeButton,
                shownMode === 'custom' && styles.modeButtonActive,
                shownMode === 'custom' && styles.modeButtonCustom,
              ]}
              onPress={() => editor.handleModeChange('custom')}
            >
              <Ionicons
                name="time"
                size={20}
                color={shownMode === 'custom' ? Colors.accent.yellow : Colors.text.tertiary}
              />
              <Text style={[
                styles.modeButtonText,
                shownMode === 'custom' && styles.modeButtonTextActive,
              ]}>
                {t.availability.partial}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="mode-busy"
              accessibilityState={{ selected: shownMode === 'busy' }}
              style={[
                styles.modeButton,
                shownMode === 'busy' && styles.modeButtonActive,
                shownMode === 'busy' && styles.modeButtonBusy,
              ]}
              onPress={() => editor.handleModeChange('busy')}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={shownMode === 'busy' ? Colors.accent.red : Colors.text.tertiary}
              />
              <Text style={[
                styles.modeButtonText,
                shownMode === 'busy' && styles.modeButtonTextActive,
              ]}>
                {t.availability.busy}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Slots (only for custom mode) */}
          {shownMode === 'custom' && selectedDayState && (
            <View style={styles.slotsSection}>
              <Text style={styles.slotsTitle}>{t.availability.busyTime}</Text>

              {/* Validation Error */}
              {editor.validationError && (
                <View style={styles.validationError}>
                  <Ionicons name="warning" size={18} color={Colors.accent.red} />
                  <Text style={styles.validationErrorText}>
                    {editor.validationError === 'overlap'
                      ? t.availability.slotsOverlap
                      : t.availability.slotSameStartEnd}
                  </Text>
                </View>
              )}

              {selectedDayState.slots.map((slot, index) => (
                <View key={index} style={styles.slotRow}>
                  <View style={styles.slotInputs}>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>{t.availability.from}</Text>
                      <TouchableOpacity
                        testID={`slot-${index}-start`}
                        style={styles.timeButton}
                        onPress={() => editor.openTimePicker(index, 'start')}
                      >
                        <Text style={styles.timeValue}>{slot.start}</Text>
                        <Ionicons name="time-outline" size={16} color={Colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.timeSeparator}>
                      <Ionicons name="arrow-forward" size={16} color={Colors.text.tertiary} />
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>{t.availability.to}</Text>
                      <TouchableOpacity
                        testID={`slot-${index}-end`}
                        style={styles.timeButton}
                        onPress={() => editor.openTimePicker(index, 'end')}
                      >
                        <Text style={styles.timeValue}>{slot.end}</Text>
                        {/* An end before the start is the next morning, and says so. */}
                        {endsNextDay(slot.start, slot.end) ? (
                          <Text style={styles.importedSource} testID={`slot-${index}-next-day`}>
                            {t.availability.nextDay}
                          </Text>
                        ) : (
                          <Ionicons name="time-outline" size={16} color={Colors.text.tertiary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {selectedDayState.slots.length > 1 && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t.common.delete}
                      style={styles.removeSlotButton}
                      onPress={() => editor.removeSlot(index)}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addSlotButton} onPress={editor.addSlot}>
                <Ionicons name="add" size={20} color={Colors.accent.purple} />
                <Text style={styles.addSlotText}>{t.availability.addSlot}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* What is already on this day without the user putting it there:
              events from the phone's calendar, and rehearsals. Shown in every
              mode, because these are what everyone else's planner is told —
              hiding them while acting on them is what made a day declared free
              read as busy to the rest of the company. Read-only: a calendar
              event is changed in the calendar, a rehearsal in its own screen. */}
          {selectedDayState?.importedSlots && selectedDayState.importedSlots.length > 0 && (
            <View style={styles.importedSection}>
              <Text style={styles.importedTitle}>{t.availability.fromCalendar}</Text>

              {selectedDayState.importedSlots.map((slot, index) => (
                <View key={`imported-${index}`} style={styles.importedRow}>
                  <Ionicons
                    name={slot.source === 'rehearsal' ? 'people-outline'
                      : slot.source === 'previous_day' ? 'moon-outline' : 'calendar-outline'}
                    size={16}
                    color={Colors.text.tertiary}
                  />
                  <Text style={styles.importedTime}>
                    {slot.isAllDay ? t.availability.allDay : `${slot.start} – ${slot.end}`}
                  </Text>
                  <Text style={styles.importedSource}>
                    {slot.source === 'rehearsal'
                      ? t.availability.fromRehearsal
                      : slot.source === 'previous_day'
                        ? t.availability.fromPreviousDay
                        : t.availability.fromDeviceCalendar}
                  </Text>
                </View>
              ))}

              <Text style={styles.importedNote}>{t.availability.importedNote}</Text>
            </View>
          )}

          {/* Info for free/busy modes */}
          {shownMode && (
            <ModeInfo mode={shownMode as DayMode} />
          )}
          </>
          )}
        </ScrollView>

        {/* Save sits with the work rather than in the header. The count is
            spelled out because one press commits every date touched so far,
            not just the one the sheet is showing. */}
        {hasChanges && (
          <View style={styles.sheetSaveBar}>
            <TouchableOpacity
              testID="availability-save"
              style={[styles.sheetSaveButton, saving && styles.sheetSaveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.text.inverse} />
              ) : (
                <Text style={styles.sheetSaveButtonText}>
                  {editor.selectedDates.length > 1
                    ? `${t.common.save} · ${t.availability.selectedDates(editor.selectedDates.length)}`
                    : t.common.save}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Time Picker Modal — Cancel keeps the slot's time (usePickerDraft) */}
      <PickerModal
        visible={editor.showTimePicker}
        onClose={editor.closeTimePicker}
        value={editor.timePickerValue}
        onConfirm={editor.confirmTimePicker}
        mode="time"
        title={editor.editingSlot?.field === 'start' ? t.availability.startTime : t.availability.endTime}
        language={language}
      />
    </SafeAreaView>
  );
}
