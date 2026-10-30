import { Alert } from 'react-native';
import { availabilityAPI } from '../../../shared/services/api';
import { AvailabilityData, DayState } from '../types';
import { validateSlot, slotsOverlap } from '../utils';
import { getDateLocale } from '../../../shared/utils/locale';
import { clockRangeEndDate, dateTimeToOffsetISOInTimezone, parseDateString } from '../../../shared/utils/time';
import { useTimezone } from '../../../shared/hooks/useClock';

import { logger } from '../../../shared/utils/logger';
/**
 * Hook for saving availability data
 * Handles validation and data transformation for API
 */
export const useAvailabilitySave = () => {
  // The day's hours are the profile's zone's, as they were read
  // (useAvailabilityData) and as the server keys the day. They went out with the
  // device's offset, so where the two differed a slot saved moved by the
  // difference — or onto another day (cause fix 14).
  const timezone = useTimezone();

  /**
   * The date and time in the profile's zone, with its offset: the text names
   * the day the slot is saved under, as the server checks (cause fix 15,
   * review 2).
   */
  const createTimestamp = (dateStr: string, timeStr: string): string =>
    dateTimeToOffsetISOInTimezone(dateStr, timeStr, timezone);

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
    // A slot is an interval starting on its day; an end before the start is
    // the next morning (clockRangeEndDate, cause fix 15). The server files it
    // under the day it starts.
    return state.slots.map((slot) => ({
      startsAt: createTimestamp(date, slot.start),
      endsAt: createTimestamp(clockRangeEndDate(date, slot.start, slot.end), slot.end),
      type: 'busy' as const,
      isAllDay: false,
    }));
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
            const dateObj = parseDateString(date);
            const locale = getDateLocale(language);
            const formattedDate = dateObj.toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            return {
              isValid: false,
              errorTitle: t.availability.cannotSave,
              errorMessage: `${t.common.error} (${formattedDate}):\n\n${t.availability.slotSameStartEnd}\n\n${t.availability.invalidSlot}`,
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
              const dateObj = parseDateString(date);
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

  /** The days a save sends, and what they hold. */
  const pendingDays = (availability: AvailabilityData, changed: Record<string, number>, today: string) => {
    const dates = Object.keys(changed).filter((date) => date >= today).sort();
    const touched: AvailabilityData = {};
    for (const date of dates) {
      if (availability[date]) touched[date] = availability[date];
    }
    return { dates, touched };
  };

  /** A save would go through as things stand: no day it sends is refused. */
  const canSave = ({ availability, changed, today, language, t }: {
    availability: AvailabilityData;
    changed: Record<string, number>;
    today: string;
    language: string;
    t: any;
  }): boolean => validateAvailability(pendingDays(availability, changed, today).touched, today, language, t).isValid;

  /**
   * Save the days the person changed — only those, each by name, each replaced
   * by exactly what it now holds (review CC05). The whole snapshot used to go,
   * so a day loaded an hour ago overwrote what had been saved to it since.
   *
   * The counters are read before the request and handed back afterwards: a day
   * edited while the save was out keeps a newer counter and stays unsaved
   * (review CC03). Past days cannot be saved and stop counting as changed.
   *
   * `announce: false` is a save on the way out (useLeaveGuard): the sheet
   * closing says it went through, and an alert raised over a sheet that is
   * being dismissed would go with it.
   */
  const saveAvailability = async ({ availability, changed, today, language, t, setSaving, markSaved, announce = true }: {
    availability: AvailabilityData;
    changed: Record<string, number>;
    today: string;
    language: string;
    t: any;
    setSaving: (saving: boolean) => void;
    markSaved: (sent: Record<string, number>) => void;
    announce?: boolean;
  }): Promise<boolean> => {
    const sent = { ...changed };
    const { dates, touched } = pendingDays(availability, sent, today);
    try {
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
      if (announce) Alert.alert(t.rehearsals.success, t.availability.saved);
      return true;
    } catch (err: any) {
      logger.error('Failed to save availability:', err);
      Alert.alert(t.common.error, err.response?.data?.error || t.availability.saveError);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    saveAvailability,
    canSave,
    entriesForDay,
    prepareEntriesForAPI,
    validateAvailability,
  };
};
