import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  FlatList,
  Platform,
  Animated,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { TabParamList } from '../../../navigation';
import { availabilityAPI } from '../../../shared/services/api';

type AvailabilityScreenProps = BottomTabScreenProps<TabParamList, 'Availability'>;

interface TimeSlot {
  start: string;
  end: string;
}

type DayMode = 'free' | 'busy' | 'custom';

interface DayState {
  mode: DayMode;
  slots: TimeSlot[];
}

interface AvailabilityData {
  [date: string]: DayState;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DAY_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.xs * 6) / 7;

// Calculate month height for scroll calculations
const MONTH_TITLE_HEIGHT = FontSize.lg + Spacing.md; // Title + marginBottom
const WEEKDAY_ROW_HEIGHT = FontSize.xs + Spacing.sm; // Labels + marginBottom
const DAY_ROW_HEIGHT = DAY_SIZE + Spacing.xs; // Day cell + marginBottom

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const DEFAULT_SLOT: TimeSlot = { start: '10:00', end: '18:00' };

// Generate months data for calendar
const generateMonths = (count: number) => {
  const months = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      key: `${date.getFullYear()}-${date.getMonth()}`,
    });
  }

  return months;
};

// Get days in month with padding for week alignment
const getDaysInMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Get day of week (0 = Sunday, convert to Monday = 0)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const days: (number | null)[] = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  // Add days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return days;
};

// Format date as YYYY-MM-DD
const formatDate = (year: number, month: number, day: number) => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Calculate scroll offset for a specific date
const calculateDateOffset = (
  targetYear: number,
  targetMonth: number,
  targetDay: number,
  months: { year: number; month: number; key: string }[]
) => {
  let offset = Spacing.xl; // Initial padding

  for (let i = 0; i < months.length; i++) {
    const m = months[i];

    if (m.year === targetYear && m.month === targetMonth - 1) {
      // Found the month, now calculate position within it
      offset += MONTH_TITLE_HEIGHT;
      offset += WEEKDAY_ROW_HEIGHT;

      // Calculate which row the day is in
      const firstDay = new Date(m.year, m.month, 1);
      let startDayOfWeek = firstDay.getDay() - 1;
      if (startDayOfWeek < 0) startDayOfWeek = 6;

      const dayIndex = startDayOfWeek + targetDay - 1;
      const rowIndex = Math.floor(dayIndex / 7);

      offset += rowIndex * DAY_ROW_HEIGHT;

      return offset;
    }

    // Add height of this month
    const firstDay = new Date(m.year, m.month, 1);
    const lastDay = new Date(m.year, m.month + 1, 0);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const totalCells = startDayOfWeek + lastDay.getDate();
    const numRows = Math.ceil(totalCells / 7);

    const monthHeight = MONTH_TITLE_HEIGHT + WEEKDAY_ROW_HEIGHT + (numRows * DAY_ROW_HEIGHT) + Spacing.xl;
    offset += monthHeight;
  }

  return offset;
};

export default function AvailabilityScreen({ navigation }: AvailabilityScreenProps) {
  const [availability, setAvailability] = useState<AvailabilityData>({});
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ index: number; field: 'start' | 'end' } | null>(null);
  const [tempTime, setTempTime] = useState(new Date());

  // Animation for bottom panel
  const panelAnimation = useRef(new Animated.Value(0)).current;
  const PANEL_HEIGHT = 320;

  const months = useMemo(() => generateMonths(7), []);
  const today = new Date().toISOString().split('T')[0];

  // Get first selected date for editing
  const selectedDate = selectedDates.length > 0 ? selectedDates[0] : null;

  // Panel is open when there are selected dates
  const panelOpen = selectedDates.length > 0;

  // Load availability data on mount
  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const response = await availabilityAPI.getAll();
      const serverData = response.data.availability;

      // Convert server format to local format
      const localData: AvailabilityData = {};
      for (const [dateKey, slots] of Object.entries(serverData)) {
        const typedSlots = slots as Array<{ startTime: string; endTime: string; type: string }>;
        if (typedSlots.length === 0) continue;

        // Ensure date is in YYYY-MM-DD format (handle Date objects from PostgreSQL)
        let formattedDate = dateKey;
        if (!dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // It's a Date object string, convert it using local date to avoid timezone issues
          const dateObj = new Date(dateKey);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        }

        // Determine mode based on type and slots
        const firstSlot = typedSlots[0];
        let mode: DayMode = 'free';

        // Strip seconds from time (HH:MM:SS -> HH:MM)
        const formatTime = (time: string) => time.substring(0, 5);
        const startTime = formatTime(firstSlot.startTime);
        const endTime = formatTime(firstSlot.endTime);

        if (firstSlot.type === 'busy' && startTime === '00:00' && endTime === '23:59') {
          // Full day busy
          mode = 'busy';
        } else if (firstSlot.type === 'available' && startTime === '00:00' && endTime === '23:59') {
          // Full day available
          mode = 'free';
        } else {
          // Partial availability - slots represent busy time
          mode = 'custom';
        }

        localData[formattedDate] = {
          mode,
          slots: typedSlots.map(s => ({
            start: formatTime(s.startTime),
            end: formatTime(s.endTime)
          })),
        };
      }

      setAvailability(localData);
    } catch (err) {
      console.error('Failed to load availability:', err);
    } finally {
      setLoading(false);
    }
  };

  // Animate panel
  useEffect(() => {
    Animated.spring(panelAnimation, {
      toValue: panelOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [panelOpen, panelAnimation]);

  const getDayState = (date: string): DayState => {
    return availability[date] || { mode: 'free', slots: [{ ...DEFAULT_SLOT }] };
  };

  const getDayStatus = (date: string): 'free' | 'busy' | 'partial' | 'none' => {
    const state = availability[date];
    if (!state) return 'none';
    if (state.mode === 'free') return 'free';
    if (state.mode === 'busy') return 'busy';
    return 'partial';
  };

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
      setSaving(true);

      // Convert local format to API format for bulk save
      const entries: { date: string; type: 'available' | 'busy' | 'tentative'; slots?: { start: string; end: string }[] }[] = [];

      for (const [date, state] of Object.entries(availability)) {
        let type: 'available' | 'busy' | 'tentative' = 'available';
        let slots: { start: string; end: string }[] | undefined;

        if (state.mode === 'free') {
          type = 'available';
          slots = [{ start: '00:00', end: '23:59' }];
        } else if (state.mode === 'busy') {
          type = 'busy';
          slots = [{ start: '00:00', end: '23:59' }];
        } else if (state.mode === 'custom') {
          // Custom mode: user specifies when they are BUSY
          type = 'tentative';
          slots = state.slots; // These are busy slots
        }

        entries.push({ date, type, slots });
      }

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

  const selectedDayState = selectedDate ? getDayState(selectedDate) : null;

  const renderMonth = ({ item }: { item: { year: number; month: number; key: string } }) => {
    const days = getDaysInMonth(item.year, item.month);

    return (
      <View style={styles.monthContainer}>
        <Text style={styles.monthTitle}>
          {MONTHS_RU[item.month]} {item.year}
        </Text>

        {/* Weekday headers */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map(day => (
            <Text key={day} style={styles.weekdayLabel}>{day}</Text>
          ))}
        </View>

        {/* Days grid */}
        <View style={styles.daysGrid}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const date = formatDate(item.year, item.month, day);
            const status = getDayStatus(date);
            const isToday = date === today;
            const isPast = date < today;
            const isSelected = selectedDates.includes(date);

            return (
              <TouchableOpacity
                key={date}
                style={[
                  styles.dayCell,
                  isToday && styles.dayCellToday,
                  isPast && styles.dayCellPast,
                  isSelected && styles.dayCellSelected,
                ]}
                onPress={() => !isPast && handleDayPress(item.year, item.month, day)}
                disabled={isPast}
              >
                <Text style={[
                  styles.dayText,
                  isToday && styles.dayTextToday,
                  isPast && styles.dayTextPast,
                  isSelected && styles.dayTextSelected,
                ]}>
                  {day}
                </Text>
                {status !== 'none' && (
                  <View style={[
                    styles.statusDot,
                    status === 'free' && styles.statusDotFree,
                    status === 'busy' && styles.statusDotBusy,
                    status === 'partial' && styles.statusDotPartial,
                  ]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
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
        <View style={styles.bottomSheetHeader}>
          <View style={styles.bottomSheetHeaderLeft}>
            <Text style={styles.bottomSheetTitle}>
              {selectedDates.length === 1
                ? new Date(selectedDate!).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                  })
                : `Выбрано: ${selectedDates.length}`
              }
            </Text>
            {selectedDates.length > 0 && (
              <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Очистить</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={clearSelection}>
            <Ionicons name="chevron-down" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.bottomSheetContent} showsVerticalScrollIndicator={false}>
          {/* Mode Selection */}
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
          {selectedDayState?.mode === 'free' && (
            <View style={styles.modeInfo}>
              <Ionicons name="information-circle" size={20} color={Colors.accent.green} />
              <Text style={styles.modeInfoText}>
                Вы доступны весь день для репетиций
              </Text>
            </View>
          )}

          {selectedDayState?.mode === 'busy' && (
            <View style={styles.modeInfo}>
              <Ionicons name="information-circle" size={20} color={Colors.accent.red} />
              <Text style={styles.modeInfoText}>
                Вы недоступны в этот день
              </Text>
            </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  saveHeaderButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.accent.purple,
    borderRadius: BorderRadius.md,
  },
  saveHeaderButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.inverse,
  },
  saveHeaderButtonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  calendarContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  monthContainer: {
    marginBottom: Spacing.xl,
  },
  monthTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekdayLabel: {
    width: DAY_SIZE,
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.medium,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  dayCellToday: {
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    borderRadius: DAY_SIZE / 2,
  },
  dayCellPast: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  dayTextToday: {
    fontWeight: FontWeight.bold,
    color: Colors.accent.purple,
  },
  dayTextPast: {
    color: Colors.text.tertiary,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  statusDotFree: {
    backgroundColor: Colors.accent.green,
  },
  statusDotBusy: {
    backgroundColor: Colors.accent.red,
  },
  statusDotPartial: {
    backgroundColor: Colors.accent.yellow,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.glass.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  bottomSheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bottomSheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  clearButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  clearButtonText: {
    fontSize: FontSize.sm,
    color: Colors.accent.purple,
    fontWeight: FontWeight.medium,
  },
  bottomSheetContent: {
    padding: Spacing.xl,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    gap: Spacing.xs,
  },
  modeButtonActive: {
    borderWidth: 2,
  },
  modeButtonFree: {
    borderColor: Colors.accent.green,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  modeButtonCustom: {
    borderColor: Colors.accent.yellow,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  modeButtonBusy: {
    borderColor: Colors.accent.red,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  modeButtonText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
  modeButtonTextActive: {
    color: Colors.text.primary,
  },
  slotsSection: {
    marginBottom: Spacing.lg,
  },
  slotsTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  slotInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
  },
  timeSeparator: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
  },
  timeLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: 4,
  },
  timeButton: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
  removeSlotButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  addSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.purple,
    borderStyle: 'dashed',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  addSlotText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modeInfoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  dayCellSelected: {
    backgroundColor: Colors.accent.purple,
    borderRadius: DAY_SIZE / 2,
  },
  dayTextSelected: {
    color: Colors.text.inverse,
    fontWeight: FontWeight.bold,
  },
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timePickerContainer: {
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  timePickerTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  timePickerCancel: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  timePickerDone: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
});
