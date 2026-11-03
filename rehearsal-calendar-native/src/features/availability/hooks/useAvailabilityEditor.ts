import { useState, useEffect, useRef } from 'react';
import { Animated, FlatList } from 'react-native';
import { DayState, DayMode, TimeSlot } from '../types';
import { validateSlots, calculateDateOffset } from '../utils';
import { availabilityAPI } from '../../../shared/services/api';
import { applyToSelectedDates } from '../utils/slotHelpers';
import { parseTimeString, formatDateToTimeString } from '../../../shared/utils/time';
import { SCREEN_HEIGHT, PANEL_HEIGHT } from '../constants';

const DEFAULT_SLOT: TimeSlot = { start: '10:00', end: '18:00' };

interface UseAvailabilityEditorProps {
  availability: Record<string, DayState>;
  setAvailability: (updater: (prev: Record<string, DayState>) => Record<string, DayState>) => void;
  /** These days now differ from what was saved. */
  markChanged: (dates: string[]) => void;
  /** These days are settled on the server, whatever was drafted for them. */
  markSettled: (dates: string[]) => void;
  /** The local calendar date; earlier days are past. */
  today: string;
  getDayState: (date: string) => DayState;
  months: Array<{ year: number; month: number; key: string }>;
  /**
   * The editor put away, its Save with it: `clear` once the screen allows —
   * asked first with something unsaved (useLeaveGuard.leave, T-026). Every way
   * the selection empties here goes through this.
   */
  putAway: (clear: () => void) => void;
}

export function useAvailabilityEditor({
  availability,
  setAvailability,
  markChanged,
  markSettled,
  today,
  getDayState,
  months,
  putAway,
}: UseAvailabilityEditorProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  // The selection as last rendered, for the deletion coming back from the server.
  const selectedRef = useRef(selectedDates);
  selectedRef.current = selectedDates;
  // A deletion that left nothing picked: the editor is put away after the
  // render that has the deleted days settled, so only what is still unsaved
  // is asked about (T-026, review 2).
  const [putAwayDue, setPutAwayDue] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Time picker state. The picker holds its own draft and hands back only a
  // confirmed time (PickerModal, usePickerDraft).
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ index: number; field: 'start' | 'end' } | null>(null);

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

    // The last day picked, tapped again, puts the editor away as its arrow
    // does (T-026, review).
    if (selectedDates.length === 1 && selectedDates[0] === date) {
      collapse();
      return;
    }

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

  /** Only once nothing is left unsaved — a save gone through; else `collapse`. */
  const clearSelection = () => {
    setSelectedDates([]);
  };

  /** The editor's arrow and "Deselect": put away through the screen. */
  const collapse = () => putAway(clearSelection);

  useEffect(() => {
    if (!putAwayDue) return;
    setPutAwayDue(false);
    collapse();
  });

  // Time picker handlers
  const openTimePicker = (slotIndex: number, field: 'start' | 'end') => {
    if (!selectedDate) return;
    setEditingSlot({ index: slotIndex, field });
    setShowTimePicker(true);
  };

  // The time the picker opens on: the slot's own.
  const editingTime = selectedDate && editingSlot
    ? getDayState(selectedDate).slots[editingSlot.index]?.[editingSlot.field]
    : undefined;
  const timePickerValue = editingTime ? parseTimeString(editingTime) : new Date();

  const closeTimePicker = () => setShowTimePicker(false);

  const confirmTimePicker = (picked: Date) => {
    if (editingSlot && selectedDates.length > 0) {
      const timeStr = formatDateToTimeString(picked);

      setAvailability(prev =>
        applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
          ...currentState,
          slots: currentState.slots.map((slot, i) =>
            i === editingSlot.index ? { ...slot, [editingSlot.field]: timeStr } : slot
          ),
        }))
      );
      markChanged(selectedDates);
    }
  };

  const handleModeChange = (mode: DayMode) => {
    if (selectedDates.length === 0) return;

    setAvailability(prev =>
      applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
        ...currentState,
        mode,
        // Switching to custom hours needs something to edit; switching away
        // leaves none. It used to leave a 10:00–18:00 placeholder behind
        // instead, which was invisible while the slot list only appeared in
        // custom mode — and became a slot the user never entered as soon as it
        // did, on a day showing custom because of a calendar event.
        slots:
          mode === 'custom'
            ? currentState.slots.length > 0
              ? currentState.slots
              : [{ ...DEFAULT_SLOT }]
            : [],
      }))
    );
    markChanged(selectedDates);
  };

  const addSlot = () => {
    if (selectedDates.length === 0) return;

    setAvailability(prev =>
      applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
        ...currentState,
        // Adding hours to a day declared free or busy makes it a day of custom
        // hours — otherwise the save, which reads the declared mode, would
        // write the whole-day entry and throw the new slot away. Reachable
        // because a day can show custom hours while still declared free, when
        // the phone's calendar has an event on it.
        mode: 'custom',
        slots: [...currentState.slots, { ...DEFAULT_SLOT }],
      }))
    );
    markChanged(selectedDates);
  };

  const removeSlot = (index: number) => {
    if (selectedDates.length === 0) return;

    setAvailability(prev =>
      applyToSelectedDates(prev, selectedDates, getDayState, (currentState) => ({
        ...currentState,
        slots: currentState.slots.filter((_, i) => i !== index),
      }))
    );
    markChanged(selectedDates);
  };

  /**
   * Delete the marks on the selected past dates, on the server as well as here.
   *
   * Only the past ones: the action is offered when the selection has any, and it
   * used to delete every selected date, the future ones included (review CC04).
   * One request for all of them, and only they are settled afterwards — it used
   * to mark the whole screen saved, so other unsaved edits looked saved and
   * were lost on the next load.
   *
   * Nothing is removed locally unless the server agreed, so a failure leaves
   * the screen telling the truth rather than a comfortable fiction.
   *
   * Only the deleted days are let go of: the rest stay picked, the editor and
   * its Save with them. It used to drop the whole selection, so a future day
   * changed and picked too was left unsaved, unasked (T-026, review 2). With
   * nothing left picked, the editor is put away as its arrow puts it.
   */
  const deletePastDates = async (onComplete: (error?: unknown) => void) => {
    const dates = selectedDates.filter((date) => date < today);
    if (dates.length === 0) return;

    try {
      await availabilityAPI.saveDays(dates.map((date) => ({ date, entries: [] })));
    } catch (error) {
      onComplete(error);
      return;
    }

    setAvailability(prev => {
      const updated = { ...prev };
      dates.forEach(date => delete updated[date]);
      return updated;
    });
    markSettled(dates);
    if (selectedRef.current.some((date) => !dates.includes(date))) {
      setSelectedDates(prev => prev.filter((date) => !dates.includes(date)));
    } else {
      setPutAwayDue(true);
    }
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
    closeTimePicker,
    editingSlot,
    timePickerValue,
    // Handlers
    handleDayPress,
    clearSelection,
    collapse,
    openTimePicker,
    confirmTimePicker,
    handleModeChange,
    addSlot,
    removeSlot,
    deletePastDates,
  };
}
