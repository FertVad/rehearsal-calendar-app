/**
 * Unit Tests for Availability Slot Validation
 *
 * Tests for src/features/availability/utils/validationUtils.ts
 * Deterministic tests without external dependencies or current time.
 */

import {
  validateSlot,
  slotsOverlap,
  validateSlots,
  timeToMinutes,
} from '../features/availability/utils/validationUtils';
import { TimeSlot } from '../features/availability/types/availability';

describe('Availability Validation Utils', () => {
  describe('timeToMinutes', () => {
    it('should convert midnight to 0 minutes', () => {
      expect(timeToMinutes('00:00')).toBe(0);
    });

    it('should convert noon to 720 minutes', () => {
      expect(timeToMinutes('12:00')).toBe(720);
    });

    it('should convert 14:30 to 870 minutes', () => {
      expect(timeToMinutes('14:30')).toBe(870);
    });

    it('should convert end of day (23:59) to 1439 minutes', () => {
      expect(timeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('validateSlot - A) end <= start validation', () => {
    it('should reject slot where start equals end', () => {
      const slot: TimeSlot = { start: '14:00', end: '14:00' };
      const result = validateSlot(slot);

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('раньше');
    });

    it('should reject slot where start is after end', () => {
      const slot: TimeSlot = { start: '16:00', end: '14:00' };
      const result = validateSlot(slot);

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept slot where start is before end', () => {
      const slot: TimeSlot = { start: '14:00', end: '16:00' };
      const result = validateSlot(slot);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept slot spanning full day', () => {
      const slot: TimeSlot = { start: '00:00', end: '23:59' };
      const result = validateSlot(slot);

      expect(result.isValid).toBe(true);
    });

    it('should accept minimal valid slot (1 minute)', () => {
      const slot: TimeSlot = { start: '14:00', end: '14:01' };
      const result = validateSlot(slot);

      expect(result.isValid).toBe(true);
    });
  });

  describe('slotsOverlap - B) overlapping slots', () => {
    it('should detect full overlap (slot2 inside slot1)', () => {
      const slot1: TimeSlot = { start: '10:00', end: '16:00' };
      const slot2: TimeSlot = { start: '12:00', end: '14:00' };

      expect(slotsOverlap(slot1, slot2)).toBe(true);
    });

    it('should detect partial overlap (slot1 and slot2 intersect)', () => {
      const slot1: TimeSlot = { start: '10:00', end: '14:00' };
      const slot2: TimeSlot = { start: '12:00', end: '16:00' };

      expect(slotsOverlap(slot1, slot2)).toBe(true);
    });

    it('should detect overlap when slot1 starts before slot2 ends', () => {
      const slot1: TimeSlot = { start: '08:00', end: '12:30' };
      const slot2: TimeSlot = { start: '10:00', end: '14:00' };

      expect(slotsOverlap(slot1, slot2)).toBe(true);
    });

    it('should detect overlap symmetrically (order independent)', () => {
      const slot1: TimeSlot = { start: '14:00', end: '18:00' };
      const slot2: TimeSlot = { start: '12:00', end: '16:00' };

      // Both orders should give same result
      expect(slotsOverlap(slot1, slot2)).toBe(true);
      expect(slotsOverlap(slot2, slot1)).toBe(true);
    });
  });

  describe('slotsOverlap - C) edge-to-edge slots (no overlap)', () => {
    it('should allow adjacent slots (end1 == start2)', () => {
      const slot1: TimeSlot = { start: '10:00', end: '14:00' };
      const slot2: TimeSlot = { start: '14:00', end: '16:00' };

      expect(slotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should allow adjacent slots in reverse order', () => {
      const slot1: TimeSlot = { start: '14:00', end: '16:00' };
      const slot2: TimeSlot = { start: '10:00', end: '14:00' };

      expect(slotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should allow separate slots with gap', () => {
      const slot1: TimeSlot = { start: '10:00', end: '12:00' };
      const slot2: TimeSlot = { start: '14:00', end: '16:00' };

      expect(slotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should allow three consecutive edge-to-edge slots', () => {
      const slot1: TimeSlot = { start: '08:00', end: '10:00' };
      const slot2: TimeSlot = { start: '10:00', end: '12:00' };
      const slot3: TimeSlot = { start: '12:00', end: '14:00' };

      expect(slotsOverlap(slot1, slot2)).toBe(false);
      expect(slotsOverlap(slot2, slot3)).toBe(false);
      expect(slotsOverlap(slot1, slot3)).toBe(false);
    });
  });

  describe('validateSlots - D) edge cases', () => {
    it('should accept empty slot list', () => {
      const slots: TimeSlot[] = [];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });

    it('should accept single valid slot', () => {
      const slots: TimeSlot[] = [{ start: '10:00', end: '12:00' }];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });

    it('should reject single invalid slot (start >= end)', () => {
      const slots: TimeSlot[] = [{ start: '12:00', end: '10:00' }];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept multiple non-overlapping slots', () => {
      const slots: TimeSlot[] = [
        { start: '08:00', end: '10:00' },
        { start: '12:00', end: '14:00' },
        { start: '16:00', end: '18:00' },
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });

    it('should accept multiple edge-to-edge slots', () => {
      const slots: TimeSlot[] = [
        { start: '08:00', end: '10:00' },
        { start: '10:00', end: '12:00' },
        { start: '12:00', end: '14:00' },
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateSlots - comprehensive validation', () => {
    it('should reject when first slot is invalid', () => {
      const slots: TimeSlot[] = [
        { start: '14:00', end: '14:00' }, // invalid
        { start: '16:00', end: '18:00' },
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('раньше');
    });

    it('should reject when middle slot is invalid', () => {
      const slots: TimeSlot[] = [
        { start: '08:00', end: '10:00' },
        { start: '12:00', end: '11:00' }, // invalid
        { start: '14:00', end: '16:00' },
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
    });

    it('should reject when slots overlap (first two)', () => {
      const slots: TimeSlot[] = [
        { start: '10:00', end: '14:00' },
        { start: '12:00', end: '16:00' }, // overlaps with first
        { start: '18:00', end: '20:00' },
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('пересекаться');
    });

    it('should reject when slots overlap (last two)', () => {
      const slots: TimeSlot[] = [
        { start: '08:00', end: '10:00' },
        { start: '12:00', end: '16:00' },
        { start: '14:00', end: '18:00' }, // overlaps with previous
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
    });

    it('should reject when non-adjacent slots overlap', () => {
      const slots: TimeSlot[] = [
        { start: '08:00', end: '12:00' },
        { start: '14:00', end: '16:00' },
        { start: '10:00', end: '11:00' }, // overlaps with first
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateSlots - E) all-day scenarios', () => {
    it('should accept all-day slot (00:00 to 23:59)', () => {
      const slots: TimeSlot[] = [{ start: '00:00', end: '23:59' }];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });

    it('should not allow end <= start for all-day format edge case', () => {
      // This tests that 00:00 start with 00:00 end is invalid
      const slots: TimeSlot[] = [{ start: '00:00', end: '00:00' }];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
    });

    it('should accept morning slot starting at midnight', () => {
      const slots: TimeSlot[] = [{ start: '00:00', end: '08:00' }];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });

    it('should accept evening slot ending at 23:59', () => {
      const slots: TimeSlot[] = [{ start: '18:00', end: '23:59' }];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });

    it('should reject if full-day slot overlaps with morning slot', () => {
      const slots: TimeSlot[] = [
        { start: '00:00', end: '23:59' },
        { start: '08:00', end: '10:00' }, // overlaps
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should accept typical work day schedule', () => {
      const slots: TimeSlot[] = [
        { start: '09:00', end: '12:00' }, // morning
        { start: '13:00', end: '17:00' }, // afternoon
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });

    it('should reject overlapping lunch break scenario', () => {
      const slots: TimeSlot[] = [
        { start: '09:00', end: '13:00' }, // morning work
        { start: '12:00', end: '14:00' }, // lunch (overlaps!)
        { start: '14:00', end: '17:00' }, // afternoon work
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(false);
    });

    it('should accept full-day split into hours', () => {
      const slots: TimeSlot[] = [
        { start: '08:00', end: '09:00' },
        { start: '09:00', end: '10:00' },
        { start: '10:00', end: '11:00' },
        { start: '11:00', end: '12:00' },
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });

    it('should accept short coffee break gaps', () => {
      const slots: TimeSlot[] = [
        { start: '09:00', end: '10:30' },
        { start: '10:45', end: '12:00' }, // 15 min gap
        { start: '13:00', end: '15:00' },
      ];
      const result = validateSlots(slots);

      expect(result.isValid).toBe(true);
    });
  });
});
