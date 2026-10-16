/**
 * Unit Tests for useAvailabilitySave Hook
 *
 * Tests validation, data transformation, and bulk save operations
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAvailabilitySave } from '../useAvailabilitySave';
import { availabilityAPI } from '../../../../shared/services/api';
import { AvailabilityData } from '../../types';
import { setProfileTimezone } from '../../../../shared/utils/time';

// Mock dependencies
jest.mock('../../../../shared/services/api');
jest.mock('../../utils', () => ({
  validateSlot: jest.fn((slot) => {
    if (!slot.start || !slot.end) {
      return { isValid: false, error: 'Missing time' };
    }
    if (slot.start >= slot.end) {
      return { isValid: false, error: 'End must be after start' };
    }
    return { isValid: true };
  }),
  slotsOverlap: jest.fn((slot1, slot2) => {
    const start1 = slot1.start;
    const end1 = slot1.end;
    const start2 = slot2.start;
    const end2 = slot2.end;
    return start1 < end2 && start2 < end1;
  }),
}));
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('useAvailabilitySave Hook', () => {
  const mockT = {
    common: {
      error: 'Error',
    },
    rehearsals: {
      success: 'Success',
    },
    availability: {
      saved: 'Availability saved',
      saveError: 'Failed to save',
      cannotSave: 'Cannot Save',
      invalidSlot: 'Please fix the slot',
      slotsOverlap: 'Slots overlap',
      fixSlots: 'Please fix overlapping slots',
      understood: 'OK',
    },
  };

  const mockSetSaving = jest.fn();
  const mockSetHasChanges = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('prepareEntriesForAPI', () => {
    it('should convert free day to all-day available entry', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'free',
          slots: [],
        },
      };

      const entries = result.current.prepareEntriesForAPI(availability);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        startsAt: '2025-12-29T00:00:00.000Z',
        endsAt: '2025-12-29T23:59:59.999Z',
        type: 'available',
        isAllDay: true,
      });
    });

    it('should convert busy day to all-day busy entry', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'busy',
          slots: [],
        },
      };

      const entries = result.current.prepareEntriesForAPI(availability);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        startsAt: '2025-12-29T00:00:00.000Z',
        endsAt: '2025-12-29T23:59:59.999Z',
        type: 'busy',
        isAllDay: true,
      });
    });

    it('should convert custom slots to timestamped entries', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'custom',
          slots: [
            { start: '10:00', end: '12:00' },
            { start: '14:00', end: '16:00' },
          ],
        },
      };

      const entries = result.current.prepareEntriesForAPI(availability);

      expect(entries).toHaveLength(2);
      expect(entries[0].type).toBe('busy');
      expect(entries[0].isAllDay).toBe(false);
      // No profile zone yet: the device's, New York (jest.config.js).
      expect(new Date(entries[0].startsAt).toISOString()).toBe('2025-12-29T15:00:00.000Z');
      expect(new Date(entries[1].startsAt).toISOString()).toBe('2025-12-29T19:00:00.000Z');
    });

    it('saves the hours in the profile\'s zone, not the device\'s (cause fix 14)', () => {
      // Tel Aviv chosen, the phone in New York: 10:00 is Tel Aviv's 10:00, as
      // the day was read and as the server keys it. It went out with the
      // device's offset: seven hours later than marked, in December.
      setProfileTimezone('Asia/Jerusalem');
      const { result } = renderHook(() => useAvailabilitySave());

      const entries = result.current.prepareEntriesForAPI({
        '2025-12-29': { mode: 'custom', slots: [{ start: '10:00', end: '12:00' }] },
      });

      expect(new Date(entries[0].startsAt).toISOString()).toBe('2025-12-29T08:00:00.000Z');
      expect(new Date(entries[0].endsAt).toISOString()).toBe('2025-12-29T10:00:00.000Z');
    });

    it('should handle multiple dates', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'busy',
          slots: [],
        },
        '2025-12-30': {
          mode: 'free',
          slots: [],
        },
      };

      const entries = result.current.prepareEntriesForAPI(availability);

      expect(entries).toHaveLength(2);
    });
  });

  describe('validateAvailability', () => {
    it('should pass validation for valid data', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'custom',
          slots: [{ start: '10:00', end: '12:00' }],
        },
      };

      const validation = result.current.validateAvailability(
        availability,
        '2025-12-01',
        'en',
        mockT
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errorTitle).toBeUndefined();
      expect(validation.errorMessage).toBeUndefined();
    });

    it('should fail validation for invalid slot', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'custom',
          slots: [{ start: '12:00', end: '10:00' }], // Invalid: end before start
        },
      };

      const validation = result.current.validateAvailability(
        availability,
        '2025-12-01',
        'en',
        mockT
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errorTitle).toBe('Cannot Save');
      expect(validation.errorMessage).toContain('End must be after start');
    });

    it('should fail validation for overlapping slots', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'custom',
          slots: [
            { start: '10:00', end: '13:00' },
            { start: '12:00', end: '14:00' }, // Overlaps with first
          ],
        },
      };

      const validation = result.current.validateAvailability(
        availability,
        '2025-12-01',
        'en',
        mockT
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errorTitle).toBe('Cannot Save');
      expect(validation.errorMessage).toContain('Slots overlap');
      expect(validation.errorMessage).toContain('10:00 - 13:00');
      expect(validation.errorMessage).toContain('12:00 - 14:00');
    });

    it('should skip validation for past dates', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-11-29': {
          mode: 'custom',
          slots: [{ start: '12:00', end: '10:00' }], // Invalid but in past
        },
      };

      const validation = result.current.validateAvailability(
        availability,
        '2025-12-01', // Today is Dec 1, Nov 29 is past
        'en',
        mockT
      );

      // Should pass because past dates are skipped
      expect(validation.isValid).toBe(true);
    });

    it('should skip validation for free/busy modes', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'busy',
          slots: [],
        },
      };

      const validation = result.current.validateAvailability(
        availability,
        '2025-12-01',
        'en',
        mockT
      );

      expect(validation.isValid).toBe(true);
    });
  });

  // Only the days the person changed go out, each named, each replaced by
  // exactly what it now holds. The whole snapshot used to go, so a day loaded
  // an hour ago overwrote what had been saved to it since (review CC05).
  describe('saveAvailability — the changed days, by name', () => {
    const save = (result: any, availability: AvailabilityData, changed: Record<string, number>,
      markSaved = jest.fn()) => result.current.saveAvailability({
      availability, changed, today: '2025-12-01', language: 'en', t: mockT, setSaving: mockSetSaving, markSaved,
    });

    it('sends only the changed days, each by name', async () => {
      (availabilityAPI.saveDays as jest.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useAvailabilitySave());
      const markSaved = jest.fn();

      let success = false;
      await act(async () => {
        success = await save(result, {
          '2025-12-29': { mode: 'custom', slots: [{ start: '10:00', end: '12:00' }] },
          '2025-12-30': { mode: 'busy', slots: [] },
        }, { '2025-12-29': 1 }, markSaved);
      });

      expect(success).toBe(true);
      expect(availabilityAPI.saveDays).toHaveBeenCalledWith([
        { date: '2025-12-29', entries: [expect.objectContaining({ type: 'busy', isAllDay: false })] },
      ]);
      expect(availabilityAPI.bulkSet).not.toHaveBeenCalled();
      expect(markSaved).toHaveBeenCalledWith({ '2025-12-29': 1 });
      expect(mockSetSaving).toHaveBeenCalledWith(true);
      expect(mockSetSaving).toHaveBeenLastCalledWith(false);
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Availability saved');
    });

    it('sends a day the person emptied as an empty list', async () => {
      (availabilityAPI.saveDays as jest.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useAvailabilitySave());

      await act(async () => { await save(result, {}, { '2025-12-29': 1 }); });

      expect(availabilityAPI.saveDays).toHaveBeenCalledWith([{ date: '2025-12-29', entries: [] }]);
    });

    it('marks saved the versions it sent, not those it finds after the answer (review CC03)', async () => {
      let finish!: () => void;
      (availabilityAPI.saveDays as jest.Mock).mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
      const { result } = renderHook(() => useAvailabilitySave());
      const markSaved = jest.fn();
      const changed: Record<string, number> = { '2025-12-29': 3 };

      let pending!: Promise<boolean>;
      act(() => { pending = save(result, { '2025-12-29': { mode: 'busy', slots: [] } }, changed, markSaved); });
      changed['2025-12-29'] = 4;
      await act(async () => { finish(); await pending; });

      expect(markSaved).toHaveBeenCalledWith({ '2025-12-29': 3 });
    });

    it('leaves out days already past, and stops counting them as unsaved', async () => {
      (availabilityAPI.saveDays as jest.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useAvailabilitySave());
      const markSaved = jest.fn();

      await act(async () => {
        await save(result, { '2025-11-30': { mode: 'busy', slots: [] }, '2025-12-29': { mode: 'busy', slots: [] } },
          { '2025-11-30': 1, '2025-12-29': 2 }, markSaved);
      });

      expect(availabilityAPI.saveDays).toHaveBeenCalledWith([expect.objectContaining({ date: '2025-12-29' })]);
      expect(markSaved).toHaveBeenCalledWith({ '2025-11-30': 1, '2025-12-29': 2 });
    });

    it('does not save if validation fails', async () => {
      const { result } = renderHook(() => useAvailabilitySave());
      const markSaved = jest.fn();

      let success = true;
      await act(async () => {
        success = await save(result, { '2025-12-29': { mode: 'custom', slots: [{ start: '14:00', end: '12:00' }] } },
          { '2025-12-29': 1 }, markSaved);
      });

      expect(success).toBe(false);
      expect(availabilityAPI.saveDays).not.toHaveBeenCalled();
      expect(markSaved).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Cannot Save', expect.any(String), expect.any(Array));
    });

    it('keeps the days unsaved and says so when the server refuses', async () => {
      (availabilityAPI.saveDays as jest.Mock).mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useAvailabilitySave());
      const markSaved = jest.fn();

      let success = true;
      await act(async () => {
        success = await save(result, { '2025-12-29': { mode: 'busy', slots: [] } }, { '2025-12-29': 1 }, markSaved);
      });

      expect(success).toBe(false);
      expect(markSaved).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to save');
      expect(mockSetSaving).toHaveBeenLastCalledWith(false);
    });
  });
});
