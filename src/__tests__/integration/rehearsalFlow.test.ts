/**
 * Integration Tests: Rehearsal Management Flow
 *
 * Tests full rehearsal workflow: Create Project → Create Rehearsal → RSVP → Edit → Delete
 */
import { projectsAPI, rehearsalsAPI } from '../../shared/services/api';

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

describe('Rehearsal Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Project → Rehearsal → RSVP → Edit → Delete Flow', () => {
    it('should complete full rehearsal management flow', async () => {
      // Step 1: Create Project
      const mockProject = {
        id: '1',
        name: 'Band Project',
        timezone: 'America/New_York',
        is_admin: true,
        created_at: '2025-12-28T00:00:00Z',
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { project: mockProject },
      });

      const projectResponse = await projectsAPI.createProject({
        name: 'Band Project',
        timezone: 'America/New_York',
      });

      expect(axios.post).toHaveBeenCalledWith('/native/projects', {
        name: 'Band Project',
        timezone: 'America/New_York',
      });
      expect(projectResponse.data.project).toEqual(mockProject);

      // Step 2: Create Rehearsal
      const mockRehearsal = {
        id: '101',
        projectId: '1',
        startsAt: '2025-12-29T18:00:00Z',
        endsAt: '2025-12-29T20:00:00Z',
        location: 'Studio A',
        created_at: '2025-12-28T10:00:00Z',
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { rehearsal: mockRehearsal },
      });

      const rehearsalResponse = await rehearsalsAPI.create('1', {
        startsAt: '2025-12-29T18:00:00Z',
        endsAt: '2025-12-29T20:00:00Z',
        location: 'Studio A',
      });

      expect(axios.post).toHaveBeenCalledWith('/native/projects/1/rehearsals', {
        startsAt: '2025-12-29T18:00:00Z',
        endsAt: '2025-12-29T20:00:00Z',
        location: 'Studio A',
      });
      expect(rehearsalResponse.data.rehearsal).toEqual(mockRehearsal);

      // Step 3: RSVP to Rehearsal
      const mockRSVP = {
        userId: '5',
        rehearsalId: '101',
        status: 'yes',
        created_at: '2025-12-28T11:00:00Z',
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { response: mockRSVP },
      });

      const rsvpResponse = await rehearsalsAPI.respond('101', 'yes');

      expect(axios.post).toHaveBeenCalledWith('/native/rehearsals/101/respond', {
        response: 'yes',
      });
      expect(rsvpResponse.data.response).toEqual(mockRSVP);

      // Step 4: Edit Rehearsal
      const updatedRehearsal = {
        ...mockRehearsal,
        location: 'Studio B',
        endsAt: '2025-12-29T21:00:00Z',
      };

      (axios.put as jest.Mock).mockResolvedValueOnce({
        data: { rehearsal: updatedRehearsal },
      });

      const updateResponse = await rehearsalsAPI.update('1', '101', {
        location: 'Studio B',
        endsAt: '2025-12-29T21:00:00Z',
      });

      expect(axios.put).toHaveBeenCalledWith('/native/projects/1/rehearsals/101', {
        location: 'Studio B',
        endsAt: '2025-12-29T21:00:00Z',
      });
      expect(updateResponse.data.rehearsal.location).toBe('Studio B');

      // Step 5: Delete Rehearsal
      (axios.delete as jest.Mock).mockResolvedValueOnce({
        data: { message: 'Rehearsal deleted' },
      });

      await rehearsalsAPI.delete('1', '101');

      expect(axios.delete).toHaveBeenCalledWith('/native/projects/1/rehearsals/101');
    });

    it('should handle validation errors when creating rehearsal', async () => {
      // Invalid time range: end time before start time
      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'End time must be after start time',
          },
        },
      });

      await expect(
        rehearsalsAPI.create('1', {
          startsAt: '2025-12-29T20:00:00Z',
          endsAt: '2025-12-29T18:00:00Z', // Invalid: before start
          location: 'Studio A',
        })
      ).rejects.toEqual({
        response: {
          status: 400,
          data: {
            error: 'End time must be after start time',
          },
        },
      });
    });

    it('should handle permission errors when editing rehearsal', async () => {
      // Non-admin trying to edit
      (axios.put as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error: 'Only admins can edit rehearsals',
          },
        },
      });

      await expect(
        rehearsalsAPI.update('1', '101', {
          location: 'New Location',
        })
      ).rejects.toEqual({
        response: {
          status: 403,
          data: {
            error: 'Only admins can edit rehearsals',
          },
        },
      });
    });
  });

  describe('Batch Loading Rehearsals', () => {
    it('should load all rehearsals across multiple projects using batch', async () => {
      const mockRehearsals = [
        {
          id: '101',
          projectId: '1',
          projectName: 'Band Project',
          startsAt: '2025-12-29T18:00:00Z',
          endsAt: '2025-12-29T20:00:00Z',
        },
        {
          id: '102',
          projectId: '2',
          projectName: 'Theater Project',
          startsAt: '2025-12-30T19:00:00Z',
          endsAt: '2025-12-30T21:00:00Z',
        },
      ];

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: { rehearsals: mockRehearsals },
      });

      const response = await rehearsalsAPI.getBatch(['1', '2']);

      expect(axios.get).toHaveBeenCalledWith('/native/rehearsals/batch', {
        params: {
          projectIds: '1,2',
        },
      });
      expect(response.data.rehearsals).toEqual(mockRehearsals);
      expect(response.data.rehearsals).toHaveLength(2);
    });

    it('should load rehearsals for specific project', async () => {
      const mockRehearsals = [
        {
          id: '101',
          projectId: '1',
          startsAt: '2025-12-29T18:00:00Z',
          endsAt: '2025-12-29T20:00:00Z',
        },
      ];

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: { rehearsals: mockRehearsals },
      });

      const response = await rehearsalsAPI.getAll('1');

      expect(axios.get).toHaveBeenCalledWith('/native/projects/1/rehearsals');
      expect(response.data.rehearsals).toEqual(mockRehearsals);
    });
  });

  describe('Conflict Detection End-to-End', () => {
    it('should detect scheduling conflicts when creating rehearsal', async () => {
      // User has busy availability during rehearsal time
      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: 'Scheduling conflict detected',
            conflicts: [
              {
                userId: '5',
                userName: 'John Doe',
                reason: 'User is marked as busy during this time',
              },
            ],
          },
        },
      });

      await expect(
        rehearsalsAPI.create('1', {
          startsAt: '2025-12-29T18:00:00Z',
          endsAt: '2025-12-29T20:00:00Z',
          participant_ids: ['5'],
        })
      ).rejects.toMatchObject({
        response: {
          status: 409,
          data: {
            error: 'Scheduling conflict detected',
          },
        },
      });
    });

    it('should warn about partial conflicts but allow creation', async () => {
      // Some participants available, some busy
      const mockRehearsal = {
        id: '101',
        projectId: '1',
        startsAt: '2025-12-29T18:00:00Z',
        endsAt: '2025-12-29T20:00:00Z',
      };

      const mockWarnings = [
        {
          userId: '6',
          userName: 'Jane Smith',
          reason: 'Partially busy (18:00-19:00)',
        },
      ];

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          rehearsal: mockRehearsal,
          warnings: mockWarnings,
        },
      });

      const response = await rehearsalsAPI.create('1', {
        startsAt: '2025-12-29T18:00:00Z',
        endsAt: '2025-12-29T20:00:00Z',
        participant_ids: ['5', '6'],
      });

      expect(response.data.rehearsal).toEqual(mockRehearsal);
      expect(response.data.warnings).toEqual(mockWarnings);
    });
  });

  describe('RSVP Management', () => {
    it('should get all responses for a rehearsal', async () => {
      const mockResponses = [
        { userId: '1', userName: 'Alice', response: 'yes' },
        { userId: '2', userName: 'Bob', response: 'yes' },
        { userId: '3', userName: 'Charlie', response: 'yes' },
      ];

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: { responses: mockResponses },
      });

      const response = await rehearsalsAPI.getResponses('101');

      expect(axios.get).toHaveBeenCalledWith('/native/rehearsals/101/responses');
      expect(response.data.responses).toEqual(mockResponses);
      expect(response.data.responses).toHaveLength(3);
    });

    it('should get my response for a rehearsal', async () => {
      const mockMyResponse = {
        userId: '5',
        rehearsalId: '101',
        response: 'yes',
        notes: 'Looking forward to it!',
      };

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: mockMyResponse,
      });

      const response = await rehearsalsAPI.getMyResponse('101');

      expect(axios.get).toHaveBeenCalledWith('/native/rehearsals/101/my-response');
      expect(response.data).toEqual(mockMyResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(rehearsalsAPI.getAll('1')).rejects.toThrow('Network Error');
    });

    it('should handle 404 for non-existent project', async () => {
      (axios.get as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 404,
          data: {
            error: 'Project not found',
          },
        },
      });

      await expect(rehearsalsAPI.getAll('999')).rejects.toMatchObject({
        response: {
          status: 404,
        },
      });
    });

    it('should handle 500 server errors', async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: 'Internal Server Error',
          },
        },
      });

      await expect(
        rehearsalsAPI.create('1', {
          startsAt: '2025-12-29T18:00:00Z',
          endsAt: '2025-12-29T20:00:00Z',
        })
      ).rejects.toMatchObject({
        response: {
          status: 500,
        },
      });
    });
  });
});
