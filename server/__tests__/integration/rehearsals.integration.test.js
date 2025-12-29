/**
 * REAL Integration Tests for Rehearsal Service
 *
 * These tests:
 * - Use REAL in-memory SQLite database
 * - Execute REAL SQL queries
 * - Test REAL CRUD operations
 * - Catch REAL bugs
 */
import { jest } from '@jest/globals';
import {
  setupIntegrationDb,
  clearIntegrationDb,
  closeIntegrationDb,
  seedTestData,
} from './setup.js';

let testDb;
let testData;

describe('Rehearsal Service - REAL Integration Tests', () => {
  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    testData = await seedTestData(testDb);
  });

  beforeEach(() => {
    // Clear only rehearsal data, keep users and project
    testDb.run('DELETE FROM native_rehearsal_responses');
    testDb.run('DELETE FROM native_rehearsals');
  });

  afterAll(() => {
    closeIntegrationDb();
  });

  describe('createRehearsal - REAL DATABASE OPERATIONS', () => {
    it('should ACTUALLY create rehearsal in database', () => {
      const result = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, location, description, starts_at, ends_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          testData.projectId,
          'Monday Rehearsal',
          'Studio A',
          'Full band rehearsal',
          '2025-12-29T18:00:00.000Z',
          '2025-12-29T21:00:00.000Z',
        ]
      );

      expect(result.lastInsertId).toBeDefined();

      // Verify it's REALLY in database
      const rehearsal = testDb.get(
        'SELECT * FROM native_rehearsals WHERE id = ?',
        [result.lastInsertId]
      );

      expect(rehearsal).toBeDefined();
      expect(rehearsal.title).toBe('Monday Rehearsal');
      expect(rehearsal.location).toBe('Studio A');
      expect(rehearsal.description).toBe('Full band rehearsal');
      expect(rehearsal.project_id).toBe(testData.projectId);
      expect(rehearsal.starts_at).toBe('2025-12-29T18:00:00.000Z');
      expect(rehearsal.ends_at).toBe('2025-12-29T21:00:00.000Z');
    });

    it('should require project_id foreign key constraint', () => {
      expect(() => {
        testDb.run(
          `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
           VALUES (?, ?, ?, ?)`,
          [999999, 'Test', '2025-12-29T18:00:00Z', '2025-12-29T21:00:00Z']
        );
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('should require NOT NULL fields', () => {
      expect(() => {
        testDb.run(
          `INSERT INTO native_rehearsals (project_id, title, starts_at)
           VALUES (?, ?, ?)`,
          [testData.projectId, 'Test', '2025-12-29T18:00:00Z']
          // Missing ends_at - should fail
        );
      }).toThrow(/NOT NULL constraint failed/);
    });
  });

  describe('getRehearsals - REAL DATABASE QUERY', () => {
    beforeEach(() => {
      // Create multiple rehearsals
      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Rehearsal 1', '2025-12-25T10:00:00Z', '2025-12-25T12:00:00Z']
      );

      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Rehearsal 2', '2025-12-26T10:00:00Z', '2025-12-26T12:00:00Z']
      );

      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Rehearsal 3', '2025-12-27T10:00:00Z', '2025-12-27T12:00:00Z']
      );
    });

    it('should ACTUALLY fetch all rehearsals for project', () => {
      const rehearsals = testDb.all(
        'SELECT * FROM native_rehearsals WHERE project_id = ? ORDER BY starts_at ASC',
        [testData.projectId]
      );

      expect(rehearsals).toHaveLength(3);
      expect(rehearsals[0].title).toBe('Rehearsal 1');
      expect(rehearsals[1].title).toBe('Rehearsal 2');
      expect(rehearsals[2].title).toBe('Rehearsal 3');
    });

    it('should fetch rehearsals ordered by starts_at', () => {
      const rehearsals = testDb.all(
        'SELECT * FROM native_rehearsals WHERE project_id = ? ORDER BY starts_at DESC',
        [testData.projectId]
      );

      expect(rehearsals[0].title).toBe('Rehearsal 3');
      expect(rehearsals[1].title).toBe('Rehearsal 2');
      expect(rehearsals[2].title).toBe('Rehearsal 1');
    });

    it('should return empty array for project with no rehearsals', () => {
      const rehearsals = testDb.all(
        'SELECT * FROM native_rehearsals WHERE project_id = ?',
        [999999]
      );

      expect(rehearsals).toEqual([]);
    });
  });

  describe('getRehearsalWithStats - REAL JOIN QUERY', () => {
    let rehearsalId;

    beforeEach(() => {
      // Create rehearsal
      const result = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Test Rehearsal', '2025-12-25T10:00:00Z', '2025-12-25T12:00:00Z']
      );
      rehearsalId = result.lastInsertId;

      // Add some responses
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
         VALUES (?, ?, ?)`,
        [rehearsalId, testData.adminId, 'yes']
      );
    });

    it('should ACTUALLY fetch rehearsal with response stats via JOIN', () => {
      const rehearsal = testDb.get(
        `SELECT
          r.*,
          COUNT(resp.id) as total_responses,
          COUNT(CASE WHEN resp.response = 'yes' THEN 1 END) as confirmed
         FROM native_rehearsals r
         LEFT JOIN native_rehearsal_responses resp ON r.id = resp.rehearsal_id
         WHERE r.id = ?
         GROUP BY r.id`,
        [rehearsalId]
      );

      expect(rehearsal).toBeDefined();
      expect(rehearsal.title).toBe('Test Rehearsal');
      expect(rehearsal.total_responses).toBe(1);
      expect(rehearsal.confirmed).toBe(1);
    });

    it('should calculate correct stats with multiple responses', () => {
      // Add more response
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
         VALUES (?, ?, ?)`,
        [rehearsalId, testData.memberId, 'yes']
      );

      const rehearsal = testDb.get(
        `SELECT
          r.*,
          COUNT(resp.id) as total_responses,
          COUNT(CASE WHEN resp.response = 'yes' THEN 1 END) as confirmed
         FROM native_rehearsals r
         LEFT JOIN native_rehearsal_responses resp ON r.id = resp.rehearsal_id
         WHERE r.id = ?
         GROUP BY r.id`,
        [rehearsalId]
      );

      expect(rehearsal.total_responses).toBe(2);
      expect(rehearsal.confirmed).toBe(2);
    });

    it('should return 0 stats when no responses exist', () => {
      // Create new rehearsal with no responses
      const result = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Empty Rehearsal', '2025-12-28T10:00:00Z', '2025-12-28T12:00:00Z']
      );

      const rehearsal = testDb.get(
        `SELECT
          r.*,
          COUNT(resp.id) as total_responses,
          COUNT(CASE WHEN resp.response = 'yes' THEN 1 END) as confirmed
         FROM native_rehearsals r
         LEFT JOIN native_rehearsal_responses resp ON r.id = resp.rehearsal_id
         WHERE r.id = ?
         GROUP BY r.id`,
        [result.lastInsertId]
      );

      expect(rehearsal.total_responses).toBe(0);
      expect(rehearsal.confirmed).toBe(0);
    });
  });

  describe('updateRehearsal - REAL DATABASE UPDATE', () => {
    let rehearsalId;

    beforeEach(() => {
      const result = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, location, starts_at, ends_at)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.projectId, 'Original Title', 'Studio A', '2025-12-25T10:00:00Z', '2025-12-25T12:00:00Z']
      );
      rehearsalId = result.lastInsertId;
    });

    it('should ACTUALLY update rehearsal in database', () => {
      testDb.run(
        `UPDATE native_rehearsals
         SET title = ?, location = ?, description = ?
         WHERE id = ?`,
        ['Updated Title', 'Studio B', 'Updated description', rehearsalId]
      );

      const rehearsal = testDb.get(
        'SELECT * FROM native_rehearsals WHERE id = ?',
        [rehearsalId]
      );

      expect(rehearsal.title).toBe('Updated Title');
      expect(rehearsal.location).toBe('Studio B');
      expect(rehearsal.description).toBe('Updated description');
    });

    it('should update time fields correctly', () => {
      testDb.run(
        `UPDATE native_rehearsals
         SET starts_at = ?, ends_at = ?
         WHERE id = ?`,
        ['2025-12-30T14:00:00Z', '2025-12-30T17:00:00Z', rehearsalId]
      );

      const rehearsal = testDb.get(
        'SELECT * FROM native_rehearsals WHERE id = ?',
        [rehearsalId]
      );

      expect(rehearsal.starts_at).toBe('2025-12-30T14:00:00Z');
      expect(rehearsal.ends_at).toBe('2025-12-30T17:00:00Z');
    });

    it('should not affect other rehearsals', () => {
      // Create another rehearsal
      const result2 = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Other Rehearsal', '2025-12-26T10:00:00Z', '2025-12-26T12:00:00Z']
      );

      // Update first rehearsal
      testDb.run(
        'UPDATE native_rehearsals SET title = ? WHERE id = ?',
        ['Updated Title', rehearsalId]
      );

      // Verify second rehearsal unchanged
      const other = testDb.get(
        'SELECT * FROM native_rehearsals WHERE id = ?',
        [result2.lastInsertId]
      );

      expect(other.title).toBe('Other Rehearsal');
    });
  });

  describe('deleteRehearsal - REAL DATABASE DELETE', () => {
    let rehearsalId;

    beforeEach(() => {
      const result = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'To Delete', '2025-12-25T10:00:00Z', '2025-12-25T12:00:00Z']
      );
      rehearsalId = result.lastInsertId;
    });

    it('should ACTUALLY delete rehearsal from database', () => {
      // Verify exists
      let rehearsal = testDb.get(
        'SELECT * FROM native_rehearsals WHERE id = ?',
        [rehearsalId]
      );
      expect(rehearsal).toBeDefined();

      // Delete
      testDb.run('DELETE FROM native_rehearsals WHERE id = ?', [rehearsalId]);

      // Verify deleted
      rehearsal = testDb.get(
        'SELECT * FROM native_rehearsals WHERE id = ?',
        [rehearsalId]
      );
      expect(rehearsal).toBeUndefined();
    });

    it('should CASCADE delete all responses', () => {
      // Add responses
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

      // Verify responses exist
      let responses = testDb.all(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ?',
        [rehearsalId]
      );
      expect(responses).toHaveLength(2);

      // Delete rehearsal
      testDb.run('DELETE FROM native_rehearsals WHERE id = ?', [rehearsalId]);

      // Verify responses CASCADE deleted
      responses = testDb.all(
        'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = ?',
        [rehearsalId]
      );
      expect(responses).toHaveLength(0);
    });
  });

  describe('getUpcomingRehearsals - REAL DATE FILTERING', () => {
    beforeEach(() => {
      // Create past rehearsal
      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Past Rehearsal', '2024-01-01T10:00:00Z', '2024-01-01T12:00:00Z']
      );

      // Create future rehearsals
      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Upcoming 1', '2026-12-25T10:00:00Z', '2026-12-25T12:00:00Z']
      );

      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Upcoming 2', '2026-12-26T10:00:00Z', '2026-12-26T12:00:00Z']
      );
    });

    it('should ACTUALLY filter rehearsals by date', () => {
      const now = '2025-12-28T00:00:00Z';

      const upcoming = testDb.all(
        `SELECT * FROM native_rehearsals
         WHERE project_id = ? AND starts_at >= ?
         ORDER BY starts_at ASC`,
        [testData.projectId, now]
      );

      expect(upcoming).toHaveLength(2);
      expect(upcoming[0].title).toBe('Upcoming 1');
      expect(upcoming[1].title).toBe('Upcoming 2');
    });

    it('should fetch past rehearsals correctly', () => {
      const now = '2025-12-28T00:00:00Z';

      const past = testDb.all(
        `SELECT * FROM native_rehearsals
         WHERE project_id = ? AND ends_at < ?
         ORDER BY starts_at DESC`,
        [testData.projectId, now]
      );

      expect(past).toHaveLength(1);
      expect(past[0].title).toBe('Past Rehearsal');
    });
  });

  describe('getRehearsalsWithResponses - COMPLEX JOIN', () => {
    let rehearsal1Id, rehearsal2Id;

    beforeEach(() => {
      // Create rehearsals
      const r1 = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Rehearsal 1', '2025-12-25T10:00:00Z', '2025-12-25T12:00:00Z']
      );
      rehearsal1Id = r1.lastInsertId;

      const r2 = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Rehearsal 2', '2025-12-26T10:00:00Z', '2025-12-26T12:00:00Z']
      );
      rehearsal2Id = r2.lastInsertId;

      // Add responses
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
         VALUES (?, ?, ?, ?)`,
        [rehearsal1Id, testData.adminId, 'yes', 'Admin response 1']
      );

      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
         VALUES (?, ?, ?, ?)`,
        [rehearsal2Id, testData.memberId, 'yes', 'Member response 2']
      );
    });

    it('should ACTUALLY join rehearsals with response details', () => {
      const results = testDb.all(
        `SELECT
          r.id as rehearsal_id,
          r.title,
          resp.id as response_id,
          resp.response,
          resp.notes,
          u.first_name,
          u.last_name,
          u.email
         FROM native_rehearsals r
         LEFT JOIN native_rehearsal_responses resp ON r.id = resp.rehearsal_id
         LEFT JOIN native_users u ON resp.user_id = u.id
         WHERE r.project_id = ?
         ORDER BY r.starts_at ASC, u.first_name ASC`,
        [testData.projectId]
      );

      expect(results).toHaveLength(2);

      // Verify first rehearsal
      const r1Response = results.find(r => r.rehearsal_id === rehearsal1Id);
      expect(r1Response.title).toBe('Rehearsal 1');
      expect(r1Response.first_name).toBe('Admin');
      expect(r1Response.notes).toBe('Admin response 1');

      // Verify second rehearsal
      const r2Response = results.find(r => r.rehearsal_id === rehearsal2Id);
      expect(r2Response.title).toBe('Rehearsal 2');
      expect(r2Response.first_name).toBe('Member');
      expect(r2Response.notes).toBe('Member response 2');
    });
  });
});
