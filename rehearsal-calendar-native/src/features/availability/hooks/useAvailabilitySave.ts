import { Alert } from 'react-native';
import { availabilityAPI } from '../../../shared/services/api';
import { AvailabilityData, DayState } from '../types';
import { validateSlot, slotsOverlap } from '../utils';
import { getDateLocale } from '../../../shared/utils/locale';

/**
 * Hook for saving availability data
 * Handles validation and data transformation for API
 */
export const useAvailabilitySave = () => {
  /**
   * Create ISO timestamp from date and time in user's timezone
   */
  const createTimestamp = (dateStr: string, timeStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    const isoDateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

    const offsetMinutes = -localDate.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    return `${isoDateTimeStr}${offsetStr}`;
  };

  type Entry = { startsAt: string; endsAt: string; type: 'available' | 'busy'; isAllDay: boolean };

  /**
   * One day's entries as the server stores them. A day with no state — emptied
   * by the person — has none, which clears it on save.
   */
  const entriesForDay = (date: string, state: DayState | undefined): Entry[] => {
    if (!state) return [];
    if (state.mode === 'free' || state.mode === 'busy') {
      return [{
        startsAt: `${date}T00:00:00.000Z`,
        endsAt: `${date}T23:59:59.999Z`,
        type: state.mode === 'free' ? 'available' : 'busy',
        isAllDay: true,
      }];
    }
    return state.slots.map((slot) => {
      // Detect midnight crossing: if end <= start as HH:MM, end belongs to
      // the next calendar day (e.g. 23:00–00:30 or 22:00–01:00).
      const startMinutes = parseInt(slot.start.split(':')[0]) * 60 + parseInt(slot.start.split(':')[1]);
      const endMinutes = parseInt(slot.end.split(':')[0]) * 60 + parseInt(slot.end.split(':')[1]);
      const endsNextDay = endMinutes <= startMinutes;

      let endDate = date;
      if (endsNextDay) {
        const next = new Date(`${date}T00:00:00`);
        next.setDate(next.getDate() + 1);
        const y = next.getFullYear();
        const m = String(next.getMonth() + 1).padStart(2, '0');
        const d = String(next.getDate()).padStart(2, '0');
        endDate = `${y}-${m}-${d}`;
      }

      return {
        startsAt: createTimestamp(date, slot.start),
        endsAt: createTimestamp(endDate, slot.end),
        type: 'busy' as const,
        isAllDay: false,
      };
    });
  };

  /**
   * Every day's entries, in one list. Skips past dates — they are immutable
   * and re-sending them is what triggered the chk_availability_time_order bug
   * for legacy bad data.
   */
  const prepareEntriesForAPI = (availability: AvailabilityData, today?: string): Entry[] =>
    Object.entries(availability)
      .filter(([date]) => !today || date >= today)
      .flatMap(([date, state]) => entriesForDay(date, state));

  /**
   * Validate availability data before saving
   * Returns error message if validation fails, null otherwise
   */
  const validateAvailability = (
    availability: AvailabilityData,
    today: string,
    language: string,
    t: any
  ): { isValid: boolean; errorTitle?: string; errorMessage?: string } => {
    const dates = Object.entries(availability);

    for (let i = 0; i < dates.length; i++) {
      const [date, state] = dates[i];

      // Skip validation for past dates
      const isPast = date < today;
      if (isPast) {
        continue;
      }

      if (state.mode === 'custom') {
        // Validate each slot individually
        for (let j = 0; j < state.slots.length; j++) {
          const slot = state.slots[j];
          const slotValidation = validateSlot(slot);

          if (!slotValidation.isValid) {
            const dateObj = new Date(date);
            const locale = getDateLocale(language);
            const formattedDate = dateObj.toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            return {
              isValid: false,
              errorTitle: t.availability.cannotSave,
              errorMessage: `${t.common.error} (${formattedDate}):\n\n${slotValidation.error}\n\n${t.availability.invalidSlot}`,
            };
          }
        }

        // Check for overlaps
        for (let j = 0; j < state.slots.length; j++) {
          for (let k = j + 1; k < state.slots.length; k++) {
            const slot1 = state.slots[j];
            const slot2 = state.slots[k];
            const overlaps = slotsOverlap(slot1, slot2);

            if (overlaps) {
              const dateObj = new Date(date);
              const locale = getDateLocale(language);
              const formattedDate = dateObj.toLocaleDateString(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });

              return {
                isValid: false,
                errorTitle: t.availability.cannotSave,
                errorMessage: `${t.common.error} (${formattedDate}):\n\n${t.availability.slotsOverlap}\n\nSlot ${j + 1}: ${slot1.start} - ${slot1.end}\nSlot ${k + 1}: ${slot2.start} - ${slot2.end}\n\n${t.availability.fixSlots}`,
              };
            }
          }
        }
      }
    }

    return { isValid: true };
  };

  /**
   * Save the days the person changed — only those, each by name, each replaced
   * by exactly what it now holds (review CC05). The whole snapshot used to go,
   * so a day loaded an hour ago overwrote what had been saved to it since.
   *
   * The counters are read before the request and handed back afterwards: a day
   * edited while the save was out keeps a newer counter and stays unsaved
   * (review CC03). Past days cannot be saved and stop counting as changed.
   */
  const saveAvailability = async ({ availability, changed, today, language, t, setSaving, markSaved }: {
    availability: AvailabilityData;
    changed: Record<string, number>;
    today: string;
    language: string;
    t: any;
    setSaving: (saving: boolean) => void;
    markSaved: (sent: Record<string, number>) => void;
  }): Promise<boolean> => {
    const sent = { ...changed };
    const dates = Object.keys(sent).filter((date) => date >= today).sort();
    try {
      const touched: AvailabilityData = {};
      for (const date of dates) {
        if (availability[date]) touched[date] = availability[date];
      }
      const validation = validateAvailability(touched, today, language, t);
      if (!validation.isValid) {
        Alert.alert(validation.errorTitle!, validation.errorMessage!, [
          { text: t.availability.understood },
        ]);
        return false;
      }

      setSaving(true);
      if (dates.length > 0) {
        await availabilityAPI.saveDays(dates.map((date) => ({ date, entries: entriesForDay(date, availability[date]) })));
      }

      markSaved(sent);
      Alert.alert(t.rehearsals.success, t.availability.saved);
      return true;
    } catch (err: any) {
      console.error('Failed to save availability:', err);
      Alert.alert(t.common.error, err.response?.data?.error || t.availability.saveError);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    saveAvailability,
    entriesForDay,
    prepareEntriesForAPI,
    validateAvailability,
  };
};
