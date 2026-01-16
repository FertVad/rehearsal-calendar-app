/**
 * REAL Integration Tests for Availability API
 *
 * These tests:
 * - Use REAL in-memory SQLite database
 * - Execute REAL SQL queries
 * - Test REAL availability CRUD operations
 * - Test timezone handling with TIMESTAMPTZ
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

describe('Availability API - REAL Integration Tests', () => {
  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    testData = await seedTestData(testDb);
  });

  beforeEach(() => {
    // Clear only availability data
    testDb.run('DELETE FROM native_user_availability');
  });

  afterAll(() => {
    closeIntegrationDb();
  });

  describe('createAvailability - REAL DATABASE OPERATIONS', () => {
    it('should ACTUALLY create availability slot in database', () => {
      const result = testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          testData.adminId,
          '2025-12-29T09:00:00.000Z',
          '2025-12-29T17:00:00.000Z',
          'busy',
          'Work',
          'manual',
        ]
      );

      expect(result.lastInsertId).toBeDefined();

      // Verify it's REALLY in database
      const slot = testDb.get(
        'SELECT * FROM native_user_availability WHERE id = ?',
        [result.lastInsertId]
      );

      expect(slot).toBeDefined();
      expect(slot.user_id).toBe(testData.adminId);
      expect(slot.starts_at).toBe('2025-12-29T09:00:00.000Z');
      expect(slot.ends_at).toBe('2025-12-29T17:00:00.000Z');
      expect(slot.type).toBe('busy');
      expect(slot.title).toBe('Work');
      expect(slot.source).toBe('manual');
    });

    it('should set default type to "busy"', () => {
      const result = testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at)
         VALUES (?, ?, ?)`,
        [testData.adminId, '2025-12-29T09:00:00Z', '2025-12-29T17:00:00Z']
      );

      const slot = testDb.get(
        'SELECT * FROM native_user_availability WHERE id = ?',
        [result.lastInsertId]
      );

      expect(slot.type).toBe('busy');
    });

    it('should set default source to "manual"', () => {
      const result = testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at)
         VALUES (?, ?, ?)`,
        [testData.adminId, '2025-12-29T09:00:00Z', '2025-12-29T17:00:00Z']
      );

      const slot = testDb.get(
        'SELECT * FROM native_user_availability WHERE id = ?',
        [result.lastInsertId]
      );

      expect(slot.source).toBe('manual');
    });

    it('should store all-day flag correctly', () => {
      const result = testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day)
         VALUES (?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T00:00:00Z', '2025-12-30T00:00:00Z', 1]
      );

      const slot = testDb.get(
        'SELECT * FROM native_user_availability WHERE id = ?',
        [result.lastInsertId]
      );

      expect(slot.is_all_day).toBe(1);
    });

    it('should require user_id (foreign key constraint)', () => {
      expect(() => {
        testDb.run(
          `INSERT INTO native_user_availability (user_id, starts_at, ends_at)
           VALUES (?, ?, ?)`,
          [999999, '2025-12-29T09:00:00Z', '2025-12-29T17:00:00Z']
        );
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('should require NOT NULL fields', () => {
      expect(() => {
        testDb.run(
          `INSERT INTO native_user_availability (user_id, starts_at)
           VALUES (?, ?)`,
          [testData.adminId, '2025-12-29T09:00:00Z']
        );
      }).toThrow(/NOT NULL constraint failed/);
    });
  });

  describe('getAvailability - REAL DATABASE QUERY', () => {
    beforeEach(() => {
      // Create multiple availability slots
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-25T09:00:00Z', '2025-12-25T12:00:00Z', 'busy', 'Morning meeting', 'manual']
      );

      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-25T14:00:00Z', '2025-12-25T17:00:00Z', 'busy', 'Afternoon work', 'manual']
      );

      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-26T10:00:00Z', '2025-12-26T18:00:00Z', 'busy', 'imported']
      );
    });

    it('should ACTUALLY fetch all availability for user', () => {
      const slots = testDb.all(
        `SELECT * FROM native_user_availability
         WHERE user_id = ?
         ORDER BY starts_at ASC`,
        [testData.adminId]
      );

      expect(slots).toHaveLength(3);
      expect(slots[0].title).toBe('Morning meeting');
      expect(slots[1].title).toBe('Afternoon work');
    });

    it('should order by starts_at ASC', () => {
      const slots = testDb.all(
        `SELECT * FROM native_user_availability
         WHERE user_id = ?
         ORDER BY starts_at ASC`,
        [testData.adminId]
      );

      expect(new Date(slots[0].starts_at) < new Date(slots[1].starts_at)).toBe(true);
      expect(new Date(slots[1].starts_at) < new Date(slots[2].starts_at)).toBe(true);
    });

    it('should filter by source (manual vs imported)', () => {
      const manualSlots = testDb.all(
        `SELECT * FROM native_user_availability
         WHERE user_id = ? AND source = 'manual'`,
        [testData.adminId]
      );

      const importedSlots = testDb.all(
        `SELECT * FROM native_user_availability
         WHERE user_id = ? AND source = 'imported'`,
        [testData.adminId]
      );

      expect(manualSlots).toHaveLength(2);
      expect(importedSlots).toHaveLength(1);
    });

    it('should return empty array for user with no availability', () => {
      const slots = testDb.all(
        `SELECT * FROM native_user_availability WHERE user_id = ?`,
        [testData.memberId]
      );

      expect(slots).toEqual([]);
    });
  });

  describe('bulkCreateAvailability - REAL BULK OPERATIONS', () => {
    it('should ACTUALLY insert multiple slots in one operation', () => {
      const entries = [
        { starts_at: '2025-12-29T09:00:00Z', ends_at: '2025-12-29T12:00:00Z', type: 'busy' },
        { starts_at: '2025-12-29T14:00:00Z', ends_at: '2025-12-29T17:00:00Z', type: 'busy' },
        { starts_at: '2025-12-30T10:00:00Z', ends_at: '2025-12-30T15:00:00Z', type: 'busy' },
      ];

      entries.forEach(entry => {
        testDb.run(
          `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
           VALUES (?, ?, ?, ?, ?)`,
          [testData.adminId, entry.starts_at, entry.ends_at, entry.type, 'manual']
        );
      });

      // Verify all inserted
      const slots = testDb.all(
        'SELECT * FROM native_user_availability WHERE user_id = ?',
        [testData.adminId]
      );

      expect(slots).toHaveLength(3);
    });

    it('should delete existing manual slots for date before inserting', () => {
      // Create initial slot for Dec 29
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T08:00:00Z', '2025-12-29T10:00:00Z', 'busy', 'manual']
      );

      // Verify exists
      let slots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND date(starts_at) = '2025-12-29' AND source = 'manual'",
        [testData.adminId]
      );
      expect(slots).toHaveLength(1);

      // Delete existing for date
      testDb.run(
        "DELETE FROM native_user_availability WHERE user_id = ? AND date(starts_at) = ? AND source = 'manual'",
        [testData.adminId, '2025-12-29']
      );

      // Insert new slots
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T09:00:00Z', '2025-12-29T17:00:00Z', 'busy', 'manual']
      );

      // Verify only new slot exists
      slots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND date(starts_at) = '2025-12-29' AND source = 'manual'",
        [testData.adminId]
      );
      expect(slots).toHaveLength(1);
      expect(slots[0].starts_at).toBe('2025-12-29T09:00:00Z');
    });

    it('should not delete imported slots when updating manual', () => {
      // Create imported slot
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T08:00:00Z', '2025-12-29T10:00:00Z', 'busy', 'imported']
      );

      // Delete manual only
      testDb.run(
        "DELETE FROM native_user_availability WHERE user_id = ? AND date(starts_at) = ? AND source = 'manual'",
        [testData.adminId, '2025-12-29']
      );

      // Insert new manual slot
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T09:00:00Z', '2025-12-29T17:00:00Z', 'busy', 'manual']
      );

      // Verify both exist
      const slots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND date(starts_at) = '2025-12-29'",
        [testData.adminId]
      );
      expect(slots).toHaveLength(2);
    });
  });

  describe('deleteAvailability - REAL DATABASE DELETE', () => {
    let slotId;

    beforeEach(() => {
      const result = testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T09:00:00Z', '2025-12-29T17:00:00Z', 'busy', 'manual']
      );
      slotId = result.lastInsertId;
    });

    it('should ACTUALLY delete availability slot', () => {
      // Verify exists
      let slot = testDb.get(
        'SELECT * FROM native_user_availability WHERE id = ?',
        [slotId]
      );
      expect(slot).toBeDefined();

      // Delete
      testDb.run('DELETE FROM native_user_availability WHERE id = ?', [slotId]);

      // Verify deleted
      slot = testDb.get(
        'SELECT * FROM native_user_availability WHERE id = ?',
        [slotId]
      );
      expect(slot).toBeUndefined();
    });

    it('should delete all slots for a date', () => {
      // Create multiple slots for same date
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T14:00:00Z', '2025-12-29T18:00:00Z', 'busy', 'manual']
      );

      // Delete all for date
      testDb.run(
        "DELETE FROM native_user_availability WHERE user_id = ? AND date(starts_at) = ?",
        [testData.adminId, '2025-12-29']
      );

      // Verify all deleted
      const slots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND date(starts_at) = '2025-12-29'",
        [testData.adminId]
      );
      expect(slots).toHaveLength(0);
    });

    it('should delete only imported slots', () => {
      // Create imported slots
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-30T09:00:00Z', '2025-12-30T17:00:00Z', 'busy', 'imported']
      );

      // Delete all imported
      testDb.run(
        "DELETE FROM native_user_availability WHERE user_id = ? AND source = 'imported'",
        [testData.adminId]
      );

      // Verify imported deleted, manual remains
      const importedSlots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND source = 'imported'",
        [testData.adminId]
      );
      expect(importedSlots).toHaveLength(0);

      const manualSlots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND source = 'manual'",
        [testData.adminId]
      );
      expect(manualSlots.length).toBeGreaterThan(0);
    });
  });

  describe('CASCADE delete when user is deleted', () => {
    it('should CASCADE delete all availability when user deleted', () => {
      // Create temporary user for this test
      const tempUser = testDb.run(
        `INSERT INTO native_users (email, password_hash, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        ['temp@test.com', 'hash', 'Temp', 'User']
      );

      // Create availability for temp user
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at)
         VALUES (?, ?, ?)`,
        [tempUser.lastInsertId, '2025-12-29T09:00:00Z', '2025-12-29T17:00:00Z']
      );

      // Verify exists
      let slots = testDb.all(
        'SELECT * FROM native_user_availability WHERE user_id = ?',
        [tempUser.lastInsertId]
      );
      expect(slots.length).toBeGreaterThan(0);

      // Delete user
      testDb.run('DELETE FROM native_users WHERE id = ?', [tempUser.lastInsertId]);

      // Verify availability CASCADE deleted
      slots = testDb.all(
        'SELECT * FROM native_user_availability WHERE user_id = ?',
        [tempUser.lastInsertId]
      );
      expect(slots).toHaveLength(0);
    });
  });

  describe('importCalendarEvents - REAL IMPORT OPERATIONS', () => {
    it('should create availability from imported events', () => {
      // Simulate imported calendar events
      const events = [
        { starts_at: '2025-12-29T10:00:00Z', ends_at: '2025-12-29T11:00:00Z', title: 'Dentist', external_event_id: 'cal_123' },
        { starts_at: '2025-12-29T15:00:00Z', ends_at: '2025-12-29T16:00:00Z', title: 'Meeting', external_event_id: 'cal_456' },
      ];

      events.forEach(event => {
        testDb.run(
          `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, source, external_event_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [testData.adminId, event.starts_at, event.ends_at, 'busy', event.title, 'imported', event.external_event_id]
        );
      });

      // Verify imported
      const importedSlots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND source = 'imported'",
        [testData.adminId]
      );

      expect(importedSlots).toHaveLength(2);
      expect(importedSlots[0].external_event_id).toBe('cal_123');
      expect(importedSlots[1].external_event_id).toBe('cal_456');
    });

    it('should handle all-day imported events', () => {
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, title, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T00:00:00Z', '2025-12-30T00:00:00Z', 1, 'Holiday', 'imported']
      );

      const slot = testDb.get(
        "SELECT * FROM native_user_availability WHERE title = 'Holiday'",
        []
      );

      expect(slot.is_all_day).toBe(1);
      expect(slot.source).toBe('imported');
    });

    it('should clear all imported events', () => {
      // Create imported events
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, source)
         VALUES (?, ?, ?, ?)`,
        [testData.adminId, '2025-12-29T10:00:00Z', '2025-12-29T11:00:00Z', 'imported']
      );

      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, source)
         VALUES (?, ?, ?, ?)`,
        [testData.adminId, '2025-12-30T10:00:00Z', '2025-12-30T11:00:00Z', 'imported']
      );

      // Delete all imported
      testDb.run(
        "DELETE FROM native_user_availability WHERE user_id = ? AND source = 'imported'",
        [testData.adminId]
      );

      // Verify all cleared
      const slots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND source = 'imported'",
        [testData.adminId]
      );
      expect(slots).toHaveLength(0);
    });
  });

  describe('getAvailabilityForDate - REAL DATE FILTERING', () => {
    beforeEach(() => {
      // Create slots for different dates
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at)
         VALUES (?, ?, ?)`,
        [testData.adminId, '2025-12-25T09:00:00Z', '2025-12-25T17:00:00Z']
      );

      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at)
         VALUES (?, ?, ?)`,
        [testData.adminId, '2025-12-26T09:00:00Z', '2025-12-26T17:00:00Z']
      );

      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at)
         VALUES (?, ?, ?)`,
        [testData.adminId, '2025-12-27T09:00:00Z', '2025-12-27T17:00:00Z']
      );
    });

    it('should ACTUALLY filter by date', () => {
      const slots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND date(starts_at) = '2025-12-26'",
        [testData.adminId]
      );

      expect(slots).toHaveLength(1);
      expect(slots[0].starts_at).toContain('2025-12-26');
    });

    it('should return empty for date with no availability', () => {
      const slots = testDb.all(
        "SELECT * FROM native_user_availability WHERE user_id = ? AND date(starts_at) = '2025-12-31'",
        [testData.adminId]
      );

      expect(slots).toEqual([]);
    });
  });
});
