import { Alert } from 'react-native';
import { availabilityAPI } from '../../../shared/services/api';
import { AvailabilityData, DayState } from '../types';
import { validateSlot, slotsOverlap } from '../utils';

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

  /**
   * Convert local availability format to API format
   */
  const prepareEntriesForAPI = (
    availability: AvailabilityData
  ): Array<{ startsAt: string; endsAt: string; type: 'available' | 'busy' | 'tentative'; isAllDay?: boolean }> => {
    const entries: Array<{
      startsAt: string;
      endsAt: string;
      type: 'available' | 'busy' | 'tentative';
      isAllDay?: boolean;
    }> = [];

    for (const [date, state] of Object.entries(availability)) {
      let type: 'available' | 'busy' | 'tentative' = 'available';

      if (state.mode === 'free') {
        type = 'available';
        entries.push({
          startsAt: `${date}T00:00:00.000Z`,
          endsAt: `${date}T23:59:59.999Z`,
          type,
          isAllDay: true,
        });
      } else if (state.mode === 'busy') {
        type = 'busy';
        entries.push({
          startsAt: `${date}T00:00:00.000Z`,
          endsAt: `${date}T23:59:59.999Z`,
          type,
          isAllDay: true,
        });
      } else if (state.mode === 'custom') {
        type = 'busy';
        for (const slot of state.slots) {
          entries.push({
            startsAt: createTimestamp(date, slot.start),
            endsAt: createTimestamp(date, slot.end),
            type,
            isAllDay: false,
          });
        }
      }
    }

    return entries;
  };

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
            const locale = language === 'ru' ? 'ru-RU' : 'en-US';
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
              const locale = language === 'ru' ? 'ru-RU' : 'en-US';
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
   * Save availability data to server
   */
  const saveAvailability = async (
    availability: AvailabilityData,
    today: string,
    language: string,
    t: any,
    setSaving: (saving: boolean) => void,
    setHasChanges: (hasChanges: boolean) => void
  ): Promise<boolean> => {
    try {
      // Validate
      const validation = validateAvailability(availability, today, language, t);
      if (!validation.isValid) {
        Alert.alert(validation.errorTitle!, validation.errorMessage!, [
          { text: t.availability.understood },
        ]);
        return false;
      }

      setSaving(true);

      // Prepare and send
      const entries = prepareEntriesForAPI(availability);
      await availabilityAPI.bulkSet(entries);

      setHasChanges(false);
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
    prepareEntriesForAPI,
    validateAvailability,
  };
};
