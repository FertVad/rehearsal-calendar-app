import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing } from '../../../shared/constants/colors';
import { ProfileStackParamList } from '../../../navigation';
import { CalendarMonth, EditorHeader, ModeInfo } from '../components';
import { getDayStatus, formatDate, generateMonths } from '../utils';
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

type AvailabilityScreenProps = NativeStackScreenProps<ProfileStackParamList, 'Availability'>;

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
    setHasChanges,
    getDayState,
    loadAvailability,
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

  const months = useMemo(() => generateMonths(7), []);

  // Editor hook for selection, validation, time picker, and slot editing
  const editor = useAvailabilityEditor({
    availability,
    setAvailability,
    setHasChanges,
    getDayState,
    months,
  });

  const [refreshing, setRefreshing] = useState(false);
  const today = new Date().toISOString().split('T')[0];

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
    await saveAvailability(availability, today, language, t, setSaving, setHasChanges);
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
        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveHeaderButton, saving && styles.saveHeaderButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <Text style={styles.saveHeaderButtonText}>{t.common.save}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

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
          {editor.selectedDate && editor.selectedDate < today && (
            <View style={styles.pastDateWarning}>
              <Ionicons name="information-circle" size={20} color={Colors.accent.yellow} />
              <Text style={styles.pastDateWarningText}>
                {t.availability.pastDateWarning}
              </Text>
            </View>
          )}

          {/* Delete button for past dates */}
          {editor.selectedDate && editor.selectedDate < today && (
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
                      onPress: () => editor.deletePastDates(() => {})
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
              style={[
                styles.modeButton,
                selectedDayState?.mode === 'free' && styles.modeButtonActive,
                selectedDayState?.mode === 'free' && styles.modeButtonFree,
              ]}
              onPress={() => editor.handleModeChange('free')}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={selectedDayState?.mode === 'free' ? Colors.accent.green : Colors.text.tertiary}
              />
              <Text style={[
                styles.modeButtonText,
                selectedDayState?.mode === 'free' && styles.modeButtonTextActive,
              ]}>
                {t.availability.free}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                selectedDayState?.mode === 'custom' && styles.modeButtonActive,
                selectedDayState?.mode === 'custom' && styles.modeButtonCustom,
              ]}
              onPress={() => editor.handleModeChange('custom')}
            >
              <Ionicons
                name="time"
                size={20}
                color={selectedDayState?.mode === 'custom' ? Colors.accent.yellow : Colors.text.tertiary}
              />
              <Text style={[
                styles.modeButtonText,
                selectedDayState?.mode === 'custom' && styles.modeButtonTextActive,
              ]}>
                {t.availability.partial}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                selectedDayState?.mode === 'busy' && styles.modeButtonActive,
                selectedDayState?.mode === 'busy' && styles.modeButtonBusy,
              ]}
              onPress={() => editor.handleModeChange('busy')}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={selectedDayState?.mode === 'busy' ? Colors.accent.red : Colors.text.tertiary}
              />
              <Text style={[
                styles.modeButtonText,
                selectedDayState?.mode === 'busy' && styles.modeButtonTextActive,
              ]}>
                {t.availability.busy}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Slots (only for custom mode) */}
          {selectedDayState?.mode === 'custom' && (
            <View style={styles.slotsSection}>
              <Text style={styles.slotsTitle}>{t.availability.busyTime}</Text>

              {/* Validation Error */}
              {editor.validationError && (
                <View style={styles.validationError}>
                  <Ionicons name="warning" size={18} color={Colors.accent.red} />
                  <Text style={styles.validationErrorText}>{editor.validationError}</Text>
                </View>
              )}

              {selectedDayState.slots.map((slot, index) => (
                <View key={index} style={styles.slotRow}>
                  <View style={styles.slotInputs}>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>{t.availability.from}</Text>
                      <TouchableOpacity
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
                        style={styles.timeButton}
                        onPress={() => editor.openTimePicker(index, 'end')}
                      >
                        <Text style={styles.timeValue}>{slot.end}</Text>
                        <Ionicons name="time-outline" size={16} color={Colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {selectedDayState.slots.length > 1 && (
                    <TouchableOpacity
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

          {/* Info for free/busy modes */}
          {selectedDayState?.mode && (
            <ModeInfo mode={selectedDayState.mode} />
          )}
          </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Time Picker Modal */}
      {editor.showTimePicker && (
        <Modal
          visible={editor.showTimePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => editor.setShowTimePicker(false)}
        >
          <Pressable
            style={styles.timePickerOverlay}
            onPress={() => editor.setShowTimePicker(false)}
          >
            <Pressable style={styles.timePickerContainer} onPress={e => e.stopPropagation()}>
              <View style={styles.timePickerHeader}>
                <TouchableOpacity onPress={() => editor.setShowTimePicker(false)}>
                  <Text style={styles.timePickerCancel}>{t.common.cancel}</Text>
                </TouchableOpacity>
                <Text style={styles.timePickerTitle}>
                  {editor.editingSlot?.field === 'start' ? t.availability.startTime : t.availability.endTime}
                </Text>
                <TouchableOpacity onPress={editor.confirmTimePicker}>
                  <Text style={styles.timePickerDone}>{t.common.done}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={editor.tempTime}
                mode="time"
                display="spinner"
                onChange={(event, date) => {
                  if (date) editor.setTempTime(date);
                }}
                locale={language}
                textColor={Colors.text.primary}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}
