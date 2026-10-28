/**
 * Validation utilities for availability time slots
 */
import { TimeSlot, SlotValidation } from '../types/availability';
import {
  timeToMinutes,
  clockRangeMinutes,
  isEmptyClockRange,
  minuteRangesOverlap,
} from '../../../shared/utils/time';

// Re-export for backward compatibility
export { timeToMinutes };

/**
 * Validate a single time slot. A slot is a clock range on its day, and an end
 * before the start is the next morning (cause fix 15): 23:00–01:00 is a
 * two-hour slot, and it used to be refused here as "end before start" before
 * the save ever reached its next-day branch (CC06). Only a slot that starts
 * where it ends says nothing.
 */
export const validateSlot = (slot: TimeSlot): SlotValidation => {
  if (isEmptyClockRange(slot.start, slot.end)) {
    return {
      isValid: false,
      error: 'sameStartEnd'
    };
  }

  return { isValid: true };
};

/**
 * Check if two slots of one day overlap, on that day's axis: one running past
 * midnight takes the evening from its start on.
 */
export const slotsOverlap = (slot1: TimeSlot, slot2: TimeSlot): boolean =>
  // 10:00-14:00 and 12:00-16:00 overlap; 10:00-14:00 and 14:00-16:00 only touch;
  // 22:00-02:00 and 23:00-23:30 overlap.
  minuteRangesOverlap(clockRangeMinutes(slot1.start, slot1.end), clockRangeMinutes(slot2.start, slot2.end));

/**
 * Validate all slots for individual validity and overlaps
 */
export const validateSlots = (slots: TimeSlot[]): SlotValidation => {
  // First validate each slot individually
  for (const slot of slots) {
    const validation = validateSlot(slot);
    if (!validation.isValid) {
      return validation;
    }
  }

  // Check for overlaps
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const overlaps = slotsOverlap(slots[i], slots[j]);
      if (overlaps) {
        return {
          isValid: false,
          error: 'overlap'
        };
      }
    }
  }

  return { isValid: true };
};
