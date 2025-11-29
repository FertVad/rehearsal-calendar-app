/**
 * Validation utilities for availability time slots
 */
import { TimeSlot, SlotValidation } from '../types/availability';

/**
 * Convert time string (HH:MM) to minutes
 */
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Validate a single time slot
 */
export const validateSlot = (slot: TimeSlot): SlotValidation => {
  const startMinutes = timeToMinutes(slot.start);
  const endMinutes = timeToMinutes(slot.end);

  if (startMinutes >= endMinutes) {
    return {
      isValid: false,
      error: 'Время начала должно быть раньше времени окончания'
    };
  }

  return { isValid: true };
};

/**
 * Check if two slots overlap
 */
export const slotsOverlap = (slot1: TimeSlot, slot2: TimeSlot): boolean => {
  const start1 = timeToMinutes(slot1.start);
  const end1 = timeToMinutes(slot1.end);
  const start2 = timeToMinutes(slot2.start);
  const end2 = timeToMinutes(slot2.end);

  // Slots overlap if one starts before the other ends
  // Examples:
  // 10:00-14:00 and 12:00-16:00 overlap (start2 < end1 && start1 < end2)
  // 10:00-14:00 and 14:00-16:00 don't overlap (adjacent, not overlapping)
  const overlaps = (start1 < end2 && end1 > start2);

  console.log(`slotsOverlap check:
    Slot 1: ${slot1.start}(${start1}) - ${slot1.end}(${end1})
    Slot 2: ${slot2.start}(${start2}) - ${slot2.end}(${end2})
    start1 < end2: ${start1} < ${end2} = ${start1 < end2}
    end1 > start2: ${end1} > ${start2} = ${end1 > start2}
    Result: ${overlaps}`);

  return overlaps;
};

/**
 * Validate all slots for individual validity and overlaps
 */
export const validateSlots = (slots: TimeSlot[]): SlotValidation => {
  console.log('validateSlots called with:', slots);

  // First validate each slot individually
  for (const slot of slots) {
    const validation = validateSlot(slot);
    console.log(`Slot ${slot.start}-${slot.end} validation:`, validation);
    if (!validation.isValid) {
      return validation;
    }
  }

  // Check for overlaps
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const overlaps = slotsOverlap(slots[i], slots[j]);
      console.log(`Checking overlap between slot ${i} (${slots[i].start}-${slots[i].end}) and slot ${j} (${slots[j].start}-${slots[j].end}): ${overlaps}`);
      if (overlaps) {
        return {
          isValid: false,
          error: 'Слоты не должны пересекаться'
        };
      }
    }
  }

  return { isValid: true };
};
