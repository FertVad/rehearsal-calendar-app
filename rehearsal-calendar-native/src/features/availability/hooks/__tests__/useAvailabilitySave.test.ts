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
      expect(entries[0].startsAt).toContain('2025-12-29');
      expect(entries[0].startsAt).toContain('10:00');
      expect(entries[1].startsAt).toContain('14:00');
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

  describe('saveAvailability', () => {
    it('should save availability successfully', async () => {
      (availabilityAPI.bulkSet as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'custom',
          slots: [{ start: '10:00', end: '12:00' }],
        },
      };

      let success = false;
      await act(async () => {
        success = await result.current.saveAvailability(
          availability,
          '2025-12-01',
          'en',
          mockT,
          mockSetSaving,
          mockSetHasChanges
        );
      });

      expect(success).toBe(true);
      expect(mockSetSaving).toHaveBeenCalledWith(true);
      expect(mockSetSaving).toHaveBeenCalledWith(false);
      expect(mockSetHasChanges).toHaveBeenCalledWith(false);
      expect(availabilityAPI.bulkSet).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Availability saved');
    });

    it('should not save if validation fails', async () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'custom',
          slots: [{ start: '12:00', end: '10:00' }], // Invalid
        },
      };

      let success = false;
      await act(async () => {
        success = await result.current.saveAvailability(
          availability,
          '2025-12-01',
          'en',
          mockT,
          mockSetSaving,
          mockSetHasChanges
        );
      });

      expect(success).toBe(false);
      expect(availabilityAPI.bulkSet).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot Save',
        expect.stringContaining('End must be after start'),
        expect.any(Array)
      );
    });

    it('should handle API errors', async () => {
      (availabilityAPI.bulkSet as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'busy',
          slots: [],
        },
      };

      let success = false;
      await act(async () => {
        success = await result.current.saveAvailability(
          availability,
          '2025-12-01',
          'en',
          mockT,
          mockSetSaving,
          mockSetHasChanges
        );
      });

      expect(success).toBe(false);
      expect(mockSetSaving).toHaveBeenCalledWith(false); // Should reset saving state
      // Falls back to generic error message when no response.data.error
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to save');
    });

    it('should show API error message when available', async () => {
      (availabilityAPI.bulkSet as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: 'Invalid date format',
          },
        },
      });

      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'busy',
          slots: [],
        },
      };

      await act(async () => {
        await result.current.saveAvailability(
          availability,
          '2025-12-01',
          'en',
          mockT,
          mockSetSaving,
          mockSetHasChanges
        );
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid date format');
    });

    it('should reset saving state even on error', async () => {
      (availabilityAPI.bulkSet as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'busy',
          slots: [],
        },
      };

      await act(async () => {
        await result.current.saveAvailability(
          availability,
          '2025-12-01',
          'en',
          mockT,
          mockSetSaving,
          mockSetHasChanges
        );
      });

      expect(mockSetSaving).toHaveBeenCalledWith(true);
      expect(mockSetSaving).toHaveBeenCalledWith(false);
    });
  });

  describe('Localization', () => {
    it('should format date in Russian when language is ru', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'custom',
          slots: [{ start: '12:00', end: '10:00' }], // Invalid
        },
      };

      const validation = result.current.validateAvailability(
        availability,
        '2025-12-01',
        'ru', // Russian
        mockT
      );

      expect(validation.isValid).toBe(false);
      // Date should be formatted in Russian locale
      expect(validation.errorMessage).toBeDefined();
    });

    it('should format date in English when language is en', () => {
      const { result } = renderHook(() => useAvailabilitySave());

      const availability: AvailabilityData = {
        '2025-12-29': {
          mode: 'custom',
          slots: [{ start: '12:00', end: '10:00' }], // Invalid
        },
      };

      const validation = result.current.validateAvailability(
        availability,
        '2025-12-01',
        'en', // English
        mockT
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errorMessage).toBeDefined();
    });
  });
});
