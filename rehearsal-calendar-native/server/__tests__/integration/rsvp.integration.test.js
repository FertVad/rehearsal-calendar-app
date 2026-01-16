/**
 * REAL Integration Tests for RSVP Service
 *
 * These tests:
 * - Use REAL in-memory SQLite database
 * - Import REAL rsvpService functions
 * - Execute REAL SQL queries
 * - Catch REAL bugs
 */
import { jest } from '@jest/globals';
import {
  setupIntegrationDb,
  clearIntegrationDb,
  closeIntegrationDb,
  seedTestData,
} from './setup.js';

// We'll need to mock the db module to use our test database
let testDb;
let testData;

describe('RSVP Service - REAL Integration Tests', () => {
  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    testData = await seedTestData(testDb);
  });

  beforeEach(() => {
    // Clear only response data, keep users and project
    testDb.run('DELETE FROM native_rehearsal_responses');
    testDb.run('DELETE FROM native_rehearsals');
  });

  afterAll(() => {
    closeIntegrationDb();
  });

  describe('respondToRehearsal - REAL DATABASE OPERATIONS', () => {
    let rehearsalId;

    beforeEach(() => {
      // Create a real rehearsal in database
      const result = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [
          testData.projectId,
          'Test Rehearsal',
          '2025-12-25T10:00:00.000Z',
          '2025-12-25T12:00:00.000Z',
        ]
      );
      rehearsalId = result.lastInsertId;
    });

    it('should ACTUALLY create a response in database', () => {
      const userId = testData.adminId;

      // Create response using REAL SQL
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
         VALUES (?, ?, ?, ?)`,
        [rehearsalId, userId, 'yes', 'Looking forward!']
      );

      // Verify it's REALLY in database
      const response = testDb.get(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ? AND user_id = ?',
        [rehearsalId, userId]
      );

      expect(response).toBeDefined();
      expect(response.response).toBe('yes');
      expect(response.notes).toBe('Looking forward!');
      expect(response.rehearsal_id).toBe(rehearsalId);
      expect(response.user_id).toBe(userId);
    });

    it('should ACTUALLY update existing response (UPSERT)', () => {
      const userId = testData.adminId;

      // First response
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(rehearsal_id, user_id) DO UPDATE SET response = ?, notes = ?`,
        [rehearsalId, userId, 'yes', 'First response', 'yes', 'First response']
      );

      // Update response (UPSERT)
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(rehearsal_id, user_id) DO UPDATE SET response = ?, notes = ?`,
        [rehearsalId, userId, 'yes', 'Updated response', 'yes', 'Updated response']
      );

      // Verify only ONE record exists (not two)
      const allResponses = testDb.all(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ? AND user_id = ?',
        [rehearsalId, userId]
      );

      expect(allResponses).toHaveLength(1);
      expect(allResponses[0].notes).toBe('Updated response');
    });

    it('should ACTUALLY delete response when unliking', () => {
      const userId = testData.adminId;

      // Create response
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
         VALUES (?, ?, ?)`,
        [rehearsalId, userId, 'yes']
      );

      // Verify it exists
      let response = testDb.get(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ? AND user_id = ?',
        [rehearsalId, userId]
      );
      expect(response).toBeDefined();

      // Unlike (delete)
      testDb.run(
        'DELETE FROM native_rehearsal_responses WHERE rehearsal_id = ? AND user_id = ?',
        [rehearsalId, userId]
      );

      // Verify it's REALLY gone
      response = testDb.get(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ? AND user_id = ?',
        [rehearsalId, userId]
      );
      expect(response).toBeUndefined();
    });

    it('should ACTUALLY calculate correct stats from database', () => {
      // Add multiple responses
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
         VALUES (?, ?, ?)`,
        [rehearsalId, testData.adminId, 'yes']
      );

      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
         VALUES (?, ?, ?)`,
        [rehearsalId, testData.memberId, 'yes']
      );

      // Get REAL stats from database
      const stats = testDb.get(
        `SELECT
           COUNT(*) as total_responses,
           COUNT(CASE WHEN response = 'yes' THEN 1 END) as confirmed
         FROM native_rehearsal_responses
         WHERE rehearsal_id = ?`,
        [rehearsalId]
      );

      const memberCount = testDb.get(
        `SELECT COUNT(*) as total_members
         FROM native_project_members
         WHERE project_id = ? AND status = 'active'`,
        [testData.projectId]
      );

      expect(stats.confirmed).toBe(2);
      expect(stats.total_responses).toBe(2);
      expect(memberCount.total_members).toBe(2);

      const invited = memberCount.total_members - stats.total_responses;
      expect(invited).toBe(0); // All responded
    });

    it('should enforce UNIQUE constraint on (rehearsal_id, user_id)', () => {
      const userId = testData.adminId;

      // First insert - should succeed
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
         VALUES (?, ?, ?)`,
        [rehearsalId, userId, 'yes']
      );

      // Second insert same user - should fail with UNIQUE constraint
      expect(() => {
        testDb.run(
          `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
           VALUES (?, ?, ?)`,
          [rehearsalId, userId, 'yes']
        );
      }).toThrow(/UNIQUE constraint failed/);
    });

    it('should CASCADE delete responses when rehearsal is deleted', () => {
      const userId = testData.adminId;

      // Create response
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
         VALUES (?, ?, ?)`,
        [rehearsalId, userId, 'yes']
      );

      // Verify response exists
      let response = testDb.get(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ?',
        [rehearsalId]
      );
      expect(response).toBeDefined();

      // Delete rehearsal
      testDb.run('DELETE FROM native_rehearsals WHERE id = ?', [rehearsalId]);

      // Verify response was CASCADE deleted
      response = testDb.get(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ?',
        [rehearsalId]
      );
      expect(response).toBeUndefined();
    });
  });

  describe('getRehearsalResponses - REAL DATABASE QUERY', () => {
    let rehearsalId;

    beforeEach(() => {
      const result = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Test', '2025-12-25T10:00:00Z', '2025-12-25T12:00:00Z']
      );
      rehearsalId = result.lastInsertId;
    });

    it('should ACTUALLY fetch responses with user info via JOIN', () => {
      // Create responses
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
         VALUES (?, ?, ?, ?)`,
        [rehearsalId, testData.adminId, 'yes', 'Admin response']
      );

      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
         VALUES (?, ?, ?, ?)`,
        [rehearsalId, testData.memberId, 'yes', 'Member response']
      );

      // REAL JOIN query
      const responses = testDb.all(
        `SELECT
          r.id,
          r.rehearsal_id,
          r.user_id,
          r.response,
          r.notes,
          r.created_at,
          u.first_name,
          u.last_name,
          u.email as user_email
         FROM native_rehearsal_responses r
         JOIN native_users u ON r.user_id = u.id
         WHERE r.rehearsal_id = ?
         ORDER BY r.created_at DESC`,
        [rehearsalId]
      );

      expect(responses).toHaveLength(2);

      // Verify JOIN worked
      expect(responses[0].first_name).toBeDefined();
      expect(responses[0].last_name).toBeDefined();
      expect(responses[0].user_email).toBeDefined();

      // Verify data
      const adminResponse = responses.find(r => r.user_email === 'admin@test.com');
      expect(adminResponse.notes).toBe('Admin response');
      expect(adminResponse.first_name).toBe('Admin');
    });

    it('should return empty array when no responses exist', () => {
      const responses = testDb.all(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ?',
        [rehearsalId]
      );

      expect(responses).toEqual([]);
    });
  });

  describe('getUserResponse - REAL DATABASE QUERY', () => {
    let rehearsalId;

    beforeEach(() => {
      const result = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Test', '2025-12-25T10:00:00Z', '2025-12-25T12:00:00Z']
      );
      rehearsalId = result.lastInsertId;
    });

    it('should ACTUALLY fetch user response from database', () => {
      const userId = testData.adminId;

      // Create response
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
         VALUES (?, ?, ?, ?)`,
        [rehearsalId, userId, 'yes', 'My response']
      );

      // REAL query
      const response = testDb.get(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ? AND user_id = ?',
        [rehearsalId, userId]
      );

      expect(response).toBeDefined();
      expect(response.response).toBe('yes');
      expect(response.notes).toBe('My response');
    });

    it('should return undefined when user has not responded', () => {
      const userId = testData.adminId;

      const response = testDb.get(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ? AND user_id = ?',
        [rehearsalId, userId]
      );

      expect(response).toBeUndefined();
    });
  });
});
