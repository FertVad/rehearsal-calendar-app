/**
 * Integration Tests: Availability Management Flow
 *
 * Tests full availability workflow: Set Availability → Get → Clear → Import Calendar Events
 */
import { availabilityAPI } from '../../shared/services/api';

// Mock axios to avoid real network requests
jest.mock('axios', () => {
  const mockAxios: any = {
    create: jest.fn(() => mockAxios),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  };
  return mockAxios;
});

import axios from 'axios';

describe('Availability Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Set → Get → Clear Availability Flow', () => {
    it('should complete full availability management flow', async () => {
      // Step 1: Set availability for multiple dates
      const availabilityEntries = [
        {
          startsAt: '2025-12-29T00:00:00.000Z',
          endsAt: '2025-12-29T23:59:59.999Z',
          type: 'available' as const,
          isAllDay: true,
        },
        {
          startsAt: '2025-12-30T10:00:00.000Z',
          endsAt: '2025-12-30T12:00:00.000Z',
          type: 'busy' as const,
          isAllDay: false,
        },
        {
          startsAt: '2025-12-30T14:00:00.000Z',
          endsAt: '2025-12-30T16:00:00.000Z',
          type: 'busy' as const,
          isAllDay: false,
        },
      ];

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Availability saved',
          count: 3,
        },
      });

      const setResponse = await availabilityAPI.bulkSet(availabilityEntries);

      expect(axios.post).toHaveBeenCalledWith('/native/availability/bulk', {
        entries: availabilityEntries,
      });
      expect(setResponse.data.count).toBe(3);

      // Step 2: Get all availability
      const mockStoredAvailability = [
        {
          id: '1',
          userId: '5',
          startsAt: '2025-12-29T00:00:00.000Z',
          endsAt: '2025-12-29T23:59:59.999Z',
          type: 'available',
          isAllDay: true,
          source: 'manual',
        },
        {
          id: '2',
          userId: '5',
          startsAt: '2025-12-30T10:00:00.000Z',
          endsAt: '2025-12-30T12:00:00.000Z',
          type: 'busy',
          isAllDay: false,
          source: 'manual',
        },
        {
          id: '3',
          userId: '5',
          startsAt: '2025-12-30T14:00:00.000Z',
          endsAt: '2025-12-30T16:00:00.000Z',
          type: 'busy',
          isAllDay: false,
          source: 'manual',
        },
      ];

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: mockStoredAvailability,
      });

      const getResponse = await availabilityAPI.getAll();

      expect(axios.get).toHaveBeenCalledWith('/native/availability');
      expect(getResponse.data).toHaveLength(3);
      expect(getResponse.data[0].type).toBe('available');
      expect(getResponse.data[0].isAllDay).toBe(true);

      // Step 3: Clear availability for specific date
      (axios.delete as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Availability cleared for date',
          deletedCount: 2,
        },
      });

      await availabilityAPI.delete('2025-12-30');

      expect(axios.delete).toHaveBeenCalledWith('/native/availability/2025-12-30');

      // Step 4: Verify remaining availability
      const remainingAvailability = [mockStoredAvailability[0]];

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: remainingAvailability,
      });

      const finalResponse = await availabilityAPI.getAll();

      expect(finalResponse.data).toHaveLength(1);
      expect(finalResponse.data[0].startsAt).toContain('2025-12-29');
    });

    it('should handle validation errors when setting availability', async () => {
      // Invalid: end time before start time
      const invalidEntry = {
        startsAt: '2025-12-29T20:00:00.000Z',
        endsAt: '2025-12-29T18:00:00.000Z', // Invalid
        type: 'busy' as const,
        isAllDay: false,
      };

      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'End time must be after start time',
          },
        },
      });

      await expect(availabilityAPI.bulkSet([invalidEntry])).rejects.toEqual({
        response: {
          status: 400,
          data: {
            error: 'End time must be after start time',
          },
        },
      });
    });

    it('should handle overlapping slots validation', async () => {
      const overlappingEntries = [
        {
          startsAt: '2025-12-29T10:00:00.000Z',
          endsAt: '2025-12-29T14:00:00.000Z',
          type: 'busy' as const,
        },
        {
          startsAt: '2025-12-29T12:00:00.000Z', // Overlaps with previous
          endsAt: '2025-12-29T16:00:00.000Z',
          type: 'busy' as const,
        },
      ];

      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'Time slots overlap',
            overlaps: [
              {
                slot1: '10:00-14:00',
                slot2: '12:00-16:00',
              },
            ],
          },
        },
      });

      await expect(availabilityAPI.bulkSet(overlappingEntries)).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            error: 'Time slots overlap',
          },
        },
      });
    });
  });

  describe('Manage Imported Calendar Events', () => {
    it('should bulk set imported calendar events as availability', async () => {
      const importedEntries = [
        {
          startsAt: '2025-12-29T09:00:00.000Z',
          endsAt: '2025-12-29T10:00:00.000Z',
          type: 'busy' as const,
          isAllDay: false,
        },
        {
          startsAt: '2025-12-30T00:00:00.000Z',
          endsAt: '2025-12-30T23:59:59.999Z',
          type: 'busy' as const,
          isAllDay: true,
        },
      ];

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Availability saved',
          count: 2,
        },
      });

      const response = await availabilityAPI.bulkSet(importedEntries);

      expect(axios.post).toHaveBeenCalledWith('/native/availability/bulk', {
        entries: importedEntries,
      });
      expect(response.data.count).toBe(2);
    });

    it('should filter manual vs imported availability slots', async () => {
      const mixedAvailability = [
        {
          id: '1',
          startsAt: '2025-12-29T10:00:00.000Z',
          endsAt: '2025-12-29T12:00:00.000Z',
          type: 'busy',
          source: 'manual',
        },
        {
          id: '2',
          startsAt: '2025-12-29T14:00:00.000Z',
          endsAt: '2025-12-29T16:00:00.000Z',
          type: 'busy',
          source: 'imported',
        },
      ];

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: mixedAvailability,
      });

      const response = await availabilityAPI.getAll();

      expect(response.data).toHaveLength(2);

      // Filter by source
      const manualSlots = response.data.filter((slot: any) => slot.source === 'manual');
      const importedSlots = response.data.filter((slot: any) => slot.source === 'imported');

      expect(manualSlots).toHaveLength(1);
      expect(importedSlots).toHaveLength(1);
    });

    it('should clear all imported slots without affecting manual slots', async () => {
      (axios.delete as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Imported availability cleared',
          deletedCount: 5,
        },
      });

      const response = await availabilityAPI.deleteAllImported();

      expect(axios.delete).toHaveBeenCalledWith('/native/availability/imported/all');
      expect(response.data.deletedCount).toBe(5);
    });

    it('should batch delete specific imported events', async () => {
      const eventIds = ['event-1', 'event-2', 'event-3'];

      (axios.delete as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Events deleted',
          deletedCount: 3,
        },
      });

      const response = await availabilityAPI.batchDeleteImported(eventIds);

      expect(axios.delete).toHaveBeenCalledWith('/native/availability/imported/batch', {
        data: { eventIds },
      });
      expect(response.data.deletedCount).toBe(3);
    });
  });

  describe('Get All Availability', () => {
    it('should get all availability slots for user', async () => {
      const mockAvailability = [
        {
          id: '1',
          startsAt: '2025-12-29T10:00:00.000Z',
          endsAt: '2025-12-29T12:00:00.000Z',
          type: 'busy',
        },
        {
          id: '2',
          startsAt: '2025-12-30T14:00:00.000Z',
          endsAt: '2025-12-30T16:00:00.000Z',
          type: 'busy',
        },
      ];

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: mockAvailability,
      });

      const response = await availabilityAPI.getAll();

      expect(axios.get).toHaveBeenCalledWith('/native/availability');
      expect(response.data).toHaveLength(2);
    });

    it('should return empty array when no availability exists', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const response = await availabilityAPI.getAll();

      expect(response.data).toEqual([]);
    });
  });

  describe('All-Day vs Timed Availability', () => {
    it('should handle all-day available slots', async () => {
      const allDayAvailable = {
        startsAt: '2025-12-29T00:00:00.000Z',
        endsAt: '2025-12-29T23:59:59.999Z',
        type: 'available' as const,
        isAllDay: true,
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Availability saved',
          count: 1,
        },
      });

      await availabilityAPI.bulkSet([allDayAvailable]);

      expect(axios.post).toHaveBeenCalledWith('/native/availability/bulk', {
        entries: [allDayAvailable],
      });
    });

    it('should handle all-day busy slots', async () => {
      const allDayBusy = {
        startsAt: '2025-12-29T00:00:00.000Z',
        endsAt: '2025-12-29T23:59:59.999Z',
        type: 'busy' as const,
        isAllDay: true,
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Availability saved',
          count: 1,
        },
      });

      await availabilityAPI.bulkSet([allDayBusy]);

      expect(axios.post).toHaveBeenCalledWith('/native/availability/bulk', {
        entries: [allDayBusy],
      });
    });

    it('should handle custom time slots', async () => {
      const customSlots = [
        {
          startsAt: '2025-12-29T09:00:00.000Z',
          endsAt: '2025-12-29T12:00:00.000Z',
          type: 'busy' as const,
          isAllDay: false,
        },
        {
          startsAt: '2025-12-29T14:00:00.000Z',
          endsAt: '2025-12-29T17:00:00.000Z',
          type: 'busy' as const,
          isAllDay: false,
        },
      ];

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          message: 'Availability saved',
          count: 2,
        },
      });

      await availabilityAPI.bulkSet(customSlots);

      expect(axios.post).toHaveBeenCalledWith('/native/availability/bulk', {
        entries: customSlots,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(availabilityAPI.getAll()).rejects.toThrow('Network Error');
    });

    it('should handle 500 server errors when saving availability', async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: 'Internal Server Error',
          },
        },
      });

      await expect(
        availabilityAPI.bulkSet([
          {
            startsAt: '2025-12-29T10:00:00.000Z',
            endsAt: '2025-12-29T12:00:00.000Z',
            type: 'busy',
          },
        ])
      ).rejects.toMatchObject({
        response: {
          status: 500,
        },
      });
    });

    it('should handle unauthorized access', async () => {
      (axios.get as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: 'Unauthorized',
          },
        },
      });

      await expect(availabilityAPI.getAll()).rejects.toMatchObject({
        response: {
          status: 401,
        },
      });
    });
  });
});
