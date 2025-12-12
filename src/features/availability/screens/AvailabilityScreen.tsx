import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  Platform,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing } from '../../../shared/constants/colors';
import { TabParamList } from '../../../navigation';
import { availabilityAPI } from '../../../shared/services/api';
import { CalendarMonth, EditorHeader, ModeInfo } from '../components';
import { getDayStatus } from '../utils';
import { styles } from '../styles';
import { SCREEN_HEIGHT, PANEL_HEIGHT } from '../constants';
import { DayMode, TimeSlot } from '../types';
import {
  generateMonths,
  formatDate,
  validateSlots,
  validateSlot,
  slotsOverlap,
  calculateDateOffset
} from '../utils';
import { useAvailabilityData } from '../hooks';

type AvailabilityScreenProps = BottomTabScreenProps<TabParamList, 'Availability'>;

const DEFAULT_SLOT: TimeSlot = { start: '10:00', end: '18:00' };

export default function AvailabilityScreen({ navigation }: AvailabilityScreenProps) {
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

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ index: number; field: 'start' | 'end' } | null>(null);
  const [tempTime, setTempTime] = useState(new Date());

  // Animation for bottom panel
  const panelAnimation = useRef(new Animated.Value(0)).current;

  const months = useMemo(() => generateMonths(7), []);
  const today = new Date().toISOString().split('T')[0];

  // Get first selected date for editing
  const selectedDate = selectedDates.length > 0 ? selectedDates[0] : null;

  // Panel is open when there are selected dates
  const panelOpen = selectedDates.length > 0;

  // Animate panel
  useEffect(() => {
    Animated.spring(panelAnimation, {
      toValue: panelOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [panelOpen, panelAnimation]);

  // Validate slots when selection or availability changes
  useEffect(() => {
    if (selectedDate) {
      const state = getDayState(selectedDate);
      if (state.mode === 'custom') {
        const validation = validateSlots(state.slots);
        setValidationError(validation.isValid ? null : validation.error!);
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  }, [selectedDate, availability]);

  const flatListRef = useRef<FlatList>(null);

  const handleDayPress = (year: number, month: number, day: number) => {
    const date = formatDate(year, month, day);

    // Simply toggle selection - panel shows/hides automatically based on selectedDates.length
    setSelectedDates(prev => {
      const exists = prev.includes(date);
      const next = exists ? prev.filter(d => d !== date) : [...prev, date];

      // Scroll to center selected date when first date is selected
      if (!exists && next.length === 1) {
        const [selectedYear, selectedMonth, selectedDay] = date.split('-').map(Number);

        if (flatListRef.current) {
          // Delay scroll to allow panel animation to start
          setTimeout(() => {
            const dateOffset = calculateDateOffset(selectedYear, selectedMonth, selectedDay, months);

            // Calculate visible area height (screen minus header, legend, panel)
            const headerHeight = 60; // Approximate header + legend height
            const visibleHeight = SCREEN_HEIGHT - headerHeight - PANEL_HEIGHT - 100; // 100 for tab bar

            // Center the date in visible area
            const centeredOffset = dateOffset - (visibleHeight / 2);

            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, centeredOffset),
              animated: true,
            });
          }, 150);
        }
      }

      return next;
    });
  };

  // Time picker handlers
  const openTimePicker = (slotIndex: number, field: 'start' | 'end') => {
    if (!selectedDate) return;

    const state = getDayState(selectedDate);
    const timeStr = state.slots[slotIndex][field];
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    setTempTime(date);
    setEditingSlot({ index: slotIndex, field });
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (date && editingSlot && selectedDates.length > 0) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      // Apply to all selected dates
      setAvailability(prev => {
        const updated = { ...prev };
        selectedDates.forEach(dateKey => {
          const currentState = updated[dateKey] || { mode: 'custom', slots: [{ ...DEFAULT_SLOT }] };
          updated[dateKey] = {
            ...currentState,
            slots: currentState.slots.map((slot, i) =>
              i === editingSlot.index ? { ...slot, [editingSlot.field]: timeStr } : slot
            ),
          };
        });
        return updated;
      });
      setHasChanges(true);
    }

    if (Platform.OS === 'ios' && event.type === 'set') {
      setShowTimePicker(false);
    }
  };

  const confirmTimePicker = () => {
    if (editingSlot && selectedDates.length > 0) {
      const hours = String(tempTime.getHours()).padStart(2, '0');
      const minutes = String(tempTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      setAvailability(prev => {
        const updated = { ...prev };
        selectedDates.forEach(dateKey => {
          const currentState = updated[dateKey] || { mode: 'custom', slots: [{ ...DEFAULT_SLOT }] };
          updated[dateKey] = {
            ...currentState,
            slots: currentState.slots.map((slot, i) =>
              i === editingSlot.index ? { ...slot, [editingSlot.field]: timeStr } : slot
            ),
          };
        });
        return updated;
      });
      setHasChanges(true);
    }
    setShowTimePicker(false);
  };

  const handleModeChange = (mode: DayMode) => {
    if (selectedDates.length === 0) return;

    // Apply to all selected dates
    setAvailability(prev => {
      const updated = { ...prev };
      selectedDates.forEach(dateKey => {
        const currentState = getDayState(dateKey);
        updated[dateKey] = {
          ...currentState,
          mode,
          slots: mode === 'custom' ? currentState.slots : [{ ...DEFAULT_SLOT }],
        };
      });
      return updated;
    });
    setHasChanges(true);
  };

  const addSlot = () => {
    if (selectedDates.length === 0) return;

    // Apply to all selected dates
    setAvailability(prev => {
      const updated = { ...prev };
      selectedDates.forEach(dateKey => {
        const currentState = getDayState(dateKey);
        updated[dateKey] = {
          ...currentState,
          slots: [...currentState.slots, { ...DEFAULT_SLOT }],
        };
      });
      return updated;
    });
    setHasChanges(true);
  };

  const removeSlot = (index: number) => {
    if (selectedDates.length === 0) return;

    // Apply to all selected dates
    setAvailability(prev => {
      const updated = { ...prev };
      selectedDates.forEach(dateKey => {
        const currentState = getDayState(dateKey);
        updated[dateKey] = {
          ...currentState,
          slots: currentState.slots.filter((_, i) => i !== index),
        };
      });
      return updated;
    });
    setHasChanges(true);
  };

  const updateSlot = (index: number, field: 'start' | 'end', value: string) => {
    if (!selectedDate) return;

    setAvailability(prev => ({
      ...prev,
      [selectedDate]: {
        ...getDayState(selectedDate),
        slots: getDayState(selectedDate).slots.map((slot, i) =>
          i === index ? { ...slot, [field]: value } : slot
        ),
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      console.log('=== SAVING AVAILABILITY ===');
      console.log('Availability data:', JSON.stringify(availability, null, 2));

      // Debug: show alert that save started
      console.log('🔍 handleSave CALLED');

      // Validate all custom slots before saving
      const dates = Object.entries(availability);
      console.log(`Total dates to check: ${dates.length}`);

      for (let i = 0; i < dates.length; i++) {
        const [date, state] = dates[i];
        console.log(`\n[${i + 1}/${dates.length}] Checking date: ${date}`);
        console.log(`  Mode: ${state.mode}`);
        console.log(`  Slots count: ${state.slots?.length || 0}`);

        // Skip validation for past dates - they're already done, no need to block saving
        const isPast = date < today;
        if (isPast) {
          console.log(`  ⏭️ Skipping validation for past date ${date}`);
          continue;
        }

        if (state.mode === 'custom') {
          console.log(`  Slots data:`, JSON.stringify(state.slots, null, 4));

          // Validate each slot individually first
          for (let j = 0; j < state.slots.length; j++) {
            const slot = state.slots[j];
            console.log(`    Slot ${j}: ${slot.start} - ${slot.end}`);
            const slotValidation = validateSlot(slot);
            console.log(`    Slot ${j} validation:`, slotValidation);

            if (!slotValidation.isValid) {
              const dateObj = new Date(date);
              const formattedDate = dateObj.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });

              console.log(`  ❌ VALIDATION FAILED for slot ${j}`);
              Alert.alert(
                'Невозможно сохранить',
                `Ошибка в дате ${formattedDate}:\n\n${slotValidation.error}\n\nПожалуйста, исправьте время слотов и попробуйте снова.`,
                [{ text: 'Понятно' }]
              );
              return;
            }
          }

          // Now check for overlaps
          console.log(`  Checking overlaps...`);
          for (let j = 0; j < state.slots.length; j++) {
            for (let k = j + 1; k < state.slots.length; k++) {
              const slot1 = state.slots[j];
              const slot2 = state.slots[k];
              const overlaps = slotsOverlap(slot1, slot2);
              console.log(`    Slots ${j} and ${k} overlap: ${overlaps}`);
              console.log(`      Slot ${j}: ${slot1.start} - ${slot1.end}`);
              console.log(`      Slot ${k}: ${slot2.start} - ${slot2.end}`);

              if (overlaps) {
                const dateObj = new Date(date);
                const formattedDate = dateObj.toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });

                console.log(`  ❌ OVERLAP DETECTED between slots ${j} and ${k}`);
                Alert.alert(
                  'Невозможно сохранить',
                  `Ошибка в дате ${formattedDate}:\n\nСлоты не должны пересекаться\n\nСлот ${j + 1}: ${slot1.start} - ${slot1.end}\nСлот ${k + 1}: ${slot2.start} - ${slot2.end}\n\nПожалуйста, исправьте время слотов и попробуйте снова.`,
                  [{ text: 'Понятно' }]
                );
                return;
              }
            }
          }

          console.log(`  ✅ All slots valid for ${date}`);
        }
      }

      console.log('\n✅ ALL VALIDATIONS PASSED, proceeding with save');

      setSaving(true);

      // Helper function to create ISO timestamp from date and time in user's timezone
      const createTimestamp = (dateStr: string, timeStr: string): string => {
        // Parse date (YYYY-MM-DD) and time (HH:mm)
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = timeStr.split(':').map(Number);

        // Create date string in ISO format without timezone
        const isoDateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

        // Create Date object which interprets this as local time
        const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

        // Get timezone offset in minutes and convert to ±HH:MM format
        const offsetMinutes = -localDate.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
        const offsetMins = Math.abs(offsetMinutes) % 60;
        const offsetSign = offsetMinutes >= 0 ? '+' : '-';
        const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

        // Return ISO string with timezone offset (not UTC)
        return `${isoDateTimeStr}${offsetStr}`;
      };

      // Convert local format to API format with ISO timestamps
      const entries: { startsAt: string; endsAt: string; type: 'available' | 'busy' | 'tentative'; isAllDay?: boolean }[] = [];

      for (const [date, state] of Object.entries(availability)) {
        let type: 'available' | 'busy' | 'tentative' = 'available';

        if (state.mode === 'free') {
          type = 'available';
          entries.push({
            startsAt: createTimestamp(date, '00:00'),
            endsAt: createTimestamp(date, '23:59'),
            type,
            isAllDay: true
          });
        } else if (state.mode === 'busy') {
          type = 'busy';
          entries.push({
            startsAt: createTimestamp(date, '00:00'),
            endsAt: createTimestamp(date, '23:59'),
            type,
            isAllDay: true
          });
        } else if (state.mode === 'custom') {
          // Custom mode: user specifies when they are BUSY
          type = 'tentative';
          for (const slot of state.slots) {
            entries.push({
              startsAt: createTimestamp(date, slot.start),
              endsAt: createTimestamp(date, slot.end),
              type,
              isAllDay: false
            });
          }
        }
      }

      console.log('Sending entries with ISO timestamps:', JSON.stringify(entries, null, 2));

      await availabilityAPI.bulkSet(entries);
      setHasChanges(false);
      Alert.alert('Успешно', 'Занятость сохранена');
    } catch (err: any) {
      console.error('Failed to save availability:', err);
      Alert.alert('Ошибка', err.response?.data?.error || 'Не удалось сохранить занятость');
    } finally {
      setSaving(false);
    }
  };

  const clearSelection = () => {
    setSelectedDates([]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAvailability();
    setRefreshing(false);
  };

  const selectedDayState = selectedDate ? getDayState(selectedDate) : null;

  const renderMonth = ({ item }: { item: { year: number; month: number; key: string } }) => {
    return (
      <CalendarMonth
        year={item.year}
        month={item.month}
        selectedDates={selectedDates}
        availability={availability}
        today={today}
        onDayPress={handleDayPress}
        getDayStatus={(date) => getDayStatus(date, availability)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Занятость</Text>
        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveHeaderButton, saving && styles.saveHeaderButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <Text style={styles.saveHeaderButtonText}>Сохранить</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.statusDotFree]} />
          <Text style={styles.legendText}>Свободен</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.statusDotPartial]} />
          <Text style={styles.legendText}>Частично</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.statusDotBusy]} />
          <Text style={styles.legendText}>Занят</Text>
        </View>
      </View>

      {/* Calendar Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={months}
          renderItem={renderMonth}
          keyExtractor={item => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.calendarContent,
            panelOpen && { paddingBottom: PANEL_HEIGHT + Spacing.xl }
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
                translateY: panelAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [PANEL_HEIGHT, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={panelOpen ? 'auto' : 'none'}
      >
        {/* Handle */}
        <View style={styles.bottomSheetHandle} />

        {/* Header */}
        <EditorHeader
          selectedCount={selectedDates.length}
          selectedDate={selectedDate}
          onClear={clearSelection}
        />

        <ScrollView style={styles.bottomSheetContent} showsVerticalScrollIndicator={false}>
          {/* Warning for past dates */}
          {selectedDate && selectedDate < today && (
            <View style={styles.pastDateWarning}>
              <Ionicons name="information-circle" size={20} color={Colors.accent.yellow} />
              <Text style={styles.pastDateWarningText}>
                Это прошедшая дата. Вы можете удалить данные, но не редактировать.
              </Text>
            </View>
          )}

          {/* Delete button for past dates */}
          {selectedDate && selectedDate < today && (
            <TouchableOpacity
              style={styles.deletePastDateButton}
              onPress={() => {
                Alert.alert(
                  'Удалить данные?',
                  `Вы уверены, что хотите удалить данные занятости для этой прошедшей даты?`,
                  [
                    { text: 'Отмена', style: 'cancel' },
                    {
                      text: 'Удалить',
                      style: 'destructive',
                      onPress: () => {
                        setAvailability(prev => {
                          const updated = { ...prev };
                          selectedDates.forEach(date => delete updated[date]);
                          return updated;
                        });
                        setHasChanges(true);
                        clearSelection();
                      }
                    }
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.accent.red} />
              <Text style={styles.deletePastDateButtonText}>Удалить данные этой даты</Text>
            </TouchableOpacity>
          )}

          {/* Mode Selection (only for future/today dates) */}
          {(!selectedDate || selectedDate >= today) && (
          <>
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                selectedDayState?.mode === 'free' && styles.modeButtonActive,
                selectedDayState?.mode === 'free' && styles.modeButtonFree,
              ]}
              onPress={() => handleModeChange('free')}
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
                Свободен
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                selectedDayState?.mode === 'custom' && styles.modeButtonActive,
                selectedDayState?.mode === 'custom' && styles.modeButtonCustom,
              ]}
              onPress={() => handleModeChange('custom')}
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
                Частично
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                selectedDayState?.mode === 'busy' && styles.modeButtonActive,
                selectedDayState?.mode === 'busy' && styles.modeButtonBusy,
              ]}
              onPress={() => handleModeChange('busy')}
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
                Занят
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Slots (only for custom mode) */}
          {selectedDayState?.mode === 'custom' && (
            <View style={styles.slotsSection}>
              <Text style={styles.slotsTitle}>Время когда занят</Text>

              {/* Validation Error */}
              {validationError && (
                <View style={styles.validationError}>
                  <Ionicons name="warning" size={18} color={Colors.accent.red} />
                  <Text style={styles.validationErrorText}>{validationError}</Text>
                </View>
              )}

              {selectedDayState.slots.map((slot, index) => (
                <View key={index} style={styles.slotRow}>
                  <View style={styles.slotInputs}>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>С</Text>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => openTimePicker(index, 'start')}
                      >
                        <Text style={styles.timeValue}>{slot.start}</Text>
                        <Ionicons name="time-outline" size={16} color={Colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.timeSeparator}>
                      <Ionicons name="arrow-forward" size={16} color={Colors.text.tertiary} />
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>До</Text>
                      <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => openTimePicker(index, 'end')}
                      >
                        <Text style={styles.timeValue}>{slot.end}</Text>
                        <Ionicons name="time-outline" size={16} color={Colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {selectedDayState.slots.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeSlotButton}
                      onPress={() => removeSlot(index)}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addSlotButton} onPress={addSlot}>
                <Ionicons name="add" size={20} color={Colors.accent.purple} />
                <Text style={styles.addSlotText}>Добавить слот</Text>
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
      {showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <Pressable
            style={styles.timePickerOverlay}
            onPress={() => setShowTimePicker(false)}
          >
            <Pressable style={styles.timePickerContainer} onPress={e => e.stopPropagation()}>
              <View style={styles.timePickerHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.timePickerCancel}>Отмена</Text>
                </TouchableOpacity>
                <Text style={styles.timePickerTitle}>
                  {editingSlot?.field === 'start' ? 'Время начала' : 'Время окончания'}
                </Text>
                <TouchableOpacity onPress={confirmTimePicker}>
                  <Text style={styles.timePickerDone}>Готово</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(event, date) => {
                  if (date) setTempTime(date);
                }}
                locale="ru"
                textColor={Colors.text.primary}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}
