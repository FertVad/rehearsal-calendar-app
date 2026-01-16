import { useState, useEffect, useRef } from 'react';
import { Animated, FlatList } from 'react-native';
import { DayState, DayMode, TimeSlot } from '../types';
import { validateSlots, calculateDateOffset } from '../utils';
import { applyToSelectedDates, parseTimeToDate, formatDateToTime } from '../utils/slotHelpers';
import { SCREEN_HEIGHT, PANEL_HEIGHT } from '../constants';

const DEFAULT_SLOT: TimeSlot = { start: '10:00', end: '18:00' };

interface UseAvailabilityEditorProps {
  availability: Record<string, DayState>;
  setAvailability: (updater: (prev: Record<string, DayState>) => Record<string, DayState>) => void;
  setHasChanges: (value: boolean) => void;
  getDayState: (date: string) => DayState;
  months: Array<{ year: number; month: number; key: string }>;
}

export function useAvailabilityEditor({
  availability,
  setAvailability,
  setHasChanges,
  getDayState,
  months,
}: UseAvailabilityEditorProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ index: number; field: 'start' | 'end' } | null>(null);
  const [tempTime, setTempTime] = useState(new Date());

  // Animation for bottom panel
  const panelAnimation = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const selectedDate = selectedDates.length > 0 ? selectedDates[0] : null;
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

  const handleDayPress = (year: number, month: number, day: number, formatDate: (y: number, m: number, d: number) => string) => {
    const date = formatDate(year, month, day);

    setSelectedDates(prev => {
      const exists = prev.includes(date);
      const next = exists ? prev.filter(d => d !== date) : [...prev, date];

      // Scroll to center selected date when first date is selected
      if (!exists && next.length === 1) {
        const [selectedYear, selectedMonth, selectedDay] = date.split('-').map(Number);

        if (flatListRef.current) {
          setTimeout(() => {
            const dateOffset = calculateDateOffset(selectedYear, selectedMonth, selectedDay, months);
            const headerHeight = 60;
            const visibleHeight = SCREEN_HEIGHT - headerHeight - PANEL_HEIGHT - 100;
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

  const clearSelection = () => {
    setSelectedDates([]);
  };

  // Time picker handlers
  const openTimePicker = (slotIndex: number, field: 'start' | 'end') => {
    if (!selectedDate) return;

    const state = getDayState(selectedDate);
    const timeStr = state.slots[slotIndex][field];
    const date = parseTimeToDate(timeStr);

    setTempTime(date);
    setEditingSlot({ index: slotIndex, field });
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, date?: Date, platform: 'ios' | 'android' = 'ios') => {
    if (platform === 'android') {
      setShowTimePicker(false);
    }

    if (date && editingSlot && selectedDates.length > 0) {
      const timeStr = formatDateToTime(date);

      setAvailability(prev =>
        applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
          ...currentState,
          slots: currentState.slots.map((slot, i) =>
            i === editingSlot.index ? { ...slot, [editingSlot.field]: timeStr } : slot
          ),
        }))
      );
      setHasChanges(true);
    }

    if (platform === 'ios' && event.type === 'set') {
      setShowTimePicker(false);
    }
  };

  const confirmTimePicker = () => {
    if (editingSlot && selectedDates.length > 0) {
      const timeStr = formatDateToTime(tempTime);

      setAvailability(prev =>
        applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
          ...currentState,
          slots: currentState.slots.map((slot, i) =>
            i === editingSlot.index ? { ...slot, [editingSlot.field]: timeStr } : slot
          ),
        }))
      );
      setHasChanges(true);
    }
    setShowTimePicker(false);
  };

  const handleModeChange = (mode: DayMode) => {
    if (selectedDates.length === 0) return;

    setAvailability(prev =>
      applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
        ...currentState,
        mode,
        slots: mode === 'custom' ? currentState.slots : [{ ...DEFAULT_SLOT }],
      }))
    );
    setHasChanges(true);
  };

  const addSlot = () => {
    if (selectedDates.length === 0) return;

    setAvailability(prev =>
      applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
        ...currentState,
        slots: [...currentState.slots, { ...DEFAULT_SLOT }],
      }))
    );
    setHasChanges(true);
  };

  const removeSlot = (index: number) => {
    if (selectedDates.length === 0) return;

    setAvailability(prev =>
      applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
        ...currentState,
        slots: currentState.slots.filter((_, i) => i !== index),
      }))
    );
    setHasChanges(true);
  };

  const deletePastDates = (onComplete: () => void) => {
    setAvailability(prev => {
      const updated = { ...prev };
      selectedDates.forEach(date => delete updated[date]);
      return updated;
    });
    setHasChanges(true);
    clearSelection();
    onComplete();
  };

  return {
    // State
    selectedDates,
    selectedDate,
    panelOpen,
    validationError,
    panelAnimation,
    flatListRef,
    // Time picker
    showTimePicker,
    setShowTimePicker,
    editingSlot,
    tempTime,
    setTempTime,
    // Handlers
    handleDayPress,
    clearSelection,
    openTimePicker,
    handleTimeChange,
    confirmTimePicker,
    handleModeChange,
    addSlot,
    removeSlot,
    deletePastDates,
  };
}
