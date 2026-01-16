/**
 * REAL Integration Tests for Calendar Sync
 *
 * These tests:
 * - Use REAL in-memory SQLite database
 * - Execute REAL SQL queries for calendar connections and mappings
 * - Test REAL CASCADE deletion
 * - Verify actual calendar sync data flow
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

describe('Calendar Sync - REAL Integration Tests', () => {
  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    testData = await seedTestData(testDb);
  });

  beforeEach(() => {
    // Clear only calendar sync data, keep users
    testDb.run('DELETE FROM native_calendar_event_mappings');
    testDb.run('DELETE FROM native_calendar_connections');
  });

  afterAll(() => {
    closeIntegrationDb();
  });

  describe('Calendar Connections - CRUD Operations', () => {
    it('should ACTUALLY create calendar connection in database', () => {
      const now = new Date().toISOString();
      const result = testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testData.adminId,
          'apple',
          'cal-123',
          'My Calendar',
          1,
          'bidirectional',
          now,
          now,
        ]
      );

      expect(result.lastInsertId).toBeDefined();

      // Verify it's REALLY in database
      const connection = testDb.get(
        'SELECT * FROM native_calendar_connections WHERE id = ?',
        [result.lastInsertId]
      );

      expect(connection).toBeDefined();
      expect(connection.user_id).toBe(testData.adminId);
      expect(connection.provider).toBe('apple');
      expect(connection.device_calendar_id).toBe('cal-123');
      expect(connection.device_calendar_name).toBe('My Calendar');
      expect(connection.sync_enabled).toBe(1);
      expect(connection.sync_direction).toBe('bidirectional');
    });

    it('should handle UPSERT - update existing connection', () => {
      const now = new Date().toISOString();

      // Create initial connection
      const result = testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'cal-123', 'Old Name', 1, 'to_device', now, now]
      );

      const connectionId = result.lastInsertId;

      // Simulate UPSERT by updating
      testDb.run(
        `UPDATE native_calendar_connections
         SET device_calendar_name = ?, sync_enabled = ?, sync_direction = ?, updated_at = ?
         WHERE user_id = ? AND provider = ? AND device_calendar_id = ?`,
        ['New Name', 0, 'from_device', now, testData.adminId, 'apple', 'cal-123']
      );

      // Verify update worked
      const connection = testDb.get(
        'SELECT * FROM native_calendar_connections WHERE id = ?',
        [connectionId]
      );

      expect(connection.device_calendar_name).toBe('New Name');
      expect(connection.sync_enabled).toBe(0);
      expect(connection.sync_direction).toBe('from_device');

      // Verify only one connection exists
      const allConnections = testDb.all(
        'SELECT * FROM native_calendar_connections WHERE user_id = ? AND provider = ?',
        [testData.adminId, 'apple']
      );

      expect(allConnections).toHaveLength(1);
    });

    it('should get all connections for a user', () => {
      const now = new Date().toISOString();

      // Create multiple connections
      testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'cal-1', 'Work Calendar', 1, 'bidirectional', now, now]
      );

      testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'google', 'cal-2', 'Personal Calendar', 1, 'to_device', now, now]
      );

      // Get all connections for user
      const connections = testDb.all(
        'SELECT * FROM native_calendar_connections WHERE user_id = ?',
        [testData.adminId]
      );

      expect(connections).toHaveLength(2);
      expect(connections[0].provider).toBe('apple');
      expect(connections[1].provider).toBe('google');
    });

    it('should delete connection', () => {
      const now = new Date().toISOString();

      const result = testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'cal-123', 'My Calendar', 1, 'bidirectional', now, now]
      );

      const connectionId = result.lastInsertId;

      // Delete connection
      testDb.run('DELETE FROM native_calendar_connections WHERE id = ?', [connectionId]);

      // Verify deleted
      const connection = testDb.get(
        'SELECT * FROM native_calendar_connections WHERE id = ?',
        [connectionId]
      );

      expect(connection).toBeUndefined();
    });

    it('should update last_sync_at timestamp', () => {
      const now = new Date().toISOString();
      const later = new Date(Date.now() + 60000).toISOString();

      const result = testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'cal-123', 'My Calendar', 1, 'bidirectional', now, now]
      );

      const connectionId = result.lastInsertId;

      // Update sync time
      testDb.run('UPDATE native_calendar_connections SET last_sync_at = ? WHERE id = ?', [
        later,
        connectionId,
      ]);

      // Verify timestamp updated
      const connection = testDb.get(
        'SELECT * FROM native_calendar_connections WHERE id = ?',
        [connectionId]
      );

      expect(connection.last_sync_at).toBe(later);
    });

    it('should enforce UNIQUE constraint (user_id, provider, device_calendar_id)', () => {
      const now = new Date().toISOString();

      testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'cal-123', 'Calendar 1', 1, 'bidirectional', now, now]
      );

      // Try to insert duplicate
      expect(() => {
        testDb.run(
          `INSERT INTO native_calendar_connections
           (user_id, provider, device_calendar_id, device_calendar_name,
            sync_enabled, sync_direction, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [testData.adminId, 'apple', 'cal-123', 'Calendar 2', 1, 'bidirectional', now, now]
        );
      }).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe('Calendar Event Mappings - CRUD Operations', () => {
    let connectionId;

    beforeEach(() => {
      // Create a connection before each test
      const now = new Date().toISOString();
      const result = testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'cal-123', 'My Calendar', 1, 'bidirectional', now, now]
      );
      connectionId = result.lastInsertId;
    });

    it('should ACTUALLY create event mapping in database', () => {
      const now = new Date().toISOString();

      const result = testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-abc', 'to_device', now]
      );

      expect(result.lastInsertId).toBeDefined();

      // Verify it's REALLY in database
      const mapping = testDb.get(
        'SELECT * FROM native_calendar_event_mappings WHERE id = ?',
        [result.lastInsertId]
      );

      expect(mapping).toBeDefined();
      expect(mapping.connection_id).toBe(connectionId);
      expect(mapping.event_type).toBe('rehearsal');
      expect(mapping.internal_event_id).toBe('101');
      expect(mapping.external_event_id).toBe('ext-event-abc');
      expect(mapping.last_sync_direction).toBe('to_device');
    });

    it('should handle UPSERT - update existing mapping', () => {
      const now = new Date().toISOString();

      // Create initial mapping
      const result = testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-old', 'to_device', now]
      );

      const mappingId = result.lastInsertId;

      // Simulate UPSERT by updating
      testDb.run(
        `UPDATE native_calendar_event_mappings
         SET external_event_id = ?, last_sync_direction = ?, last_sync_at = ?
         WHERE connection_id = ? AND event_type = ? AND internal_event_id = ?`,
        ['ext-event-new', 'from_device', now, connectionId, 'rehearsal', '101']
      );

      // Verify update worked
      const mapping = testDb.get(
        'SELECT * FROM native_calendar_event_mappings WHERE id = ?',
        [mappingId]
      );

      expect(mapping.external_event_id).toBe('ext-event-new');
      expect(mapping.last_sync_direction).toBe('from_device');

      // Verify only one mapping exists
      const allMappings = testDb.all(
        'SELECT * FROM native_calendar_event_mappings WHERE internal_event_id = ? AND event_type = ?',
        ['101', 'rehearsal']
      );

      expect(allMappings).toHaveLength(1);
    });

    it('should get all mappings for a connection', () => {
      const now = new Date().toISOString();

      // Create multiple mappings
      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-1', 'to_device', now]
      );

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '102', 'ext-event-2', 'to_device', now]
      );

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'availability', '201', 'ext-event-3', 'from_device', now]
      );

      // Get all mappings
      const mappings = testDb.all(
        'SELECT * FROM native_calendar_event_mappings WHERE connection_id = ?',
        [connectionId]
      );

      expect(mappings).toHaveLength(3);
    });

    it('should filter mappings by event_type', () => {
      const now = new Date().toISOString();

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-1', 'to_device', now]
      );

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'availability', '201', 'ext-event-2', 'from_device', now]
      );

      // Get only rehearsal mappings
      const rehearsalMappings = testDb.all(
        'SELECT * FROM native_calendar_event_mappings WHERE connection_id = ? AND event_type = ?',
        [connectionId, 'rehearsal']
      );

      expect(rehearsalMappings).toHaveLength(1);
      expect(rehearsalMappings[0].event_type).toBe('rehearsal');
    });

    it('should get mapping by event (eventType + internalEventId)', () => {
      const now = new Date().toISOString();

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-abc', 'to_device', now]
      );

      // Get mapping by event
      const mapping = testDb.get(
        'SELECT * FROM native_calendar_event_mappings WHERE event_type = ? AND internal_event_id = ?',
        ['rehearsal', '101']
      );

      expect(mapping).toBeDefined();
      expect(mapping.external_event_id).toBe('ext-event-abc');
    });

    it('should delete mapping by ID', () => {
      const now = new Date().toISOString();

      const result = testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-abc', 'to_device', now]
      );

      const mappingId = result.lastInsertId;

      // Delete mapping
      testDb.run('DELETE FROM native_calendar_event_mappings WHERE id = ?', [mappingId]);

      // Verify deleted
      const mapping = testDb.get('SELECT * FROM native_calendar_event_mappings WHERE id = ?', [
        mappingId,
      ]);

      expect(mapping).toBeUndefined();
    });

    it('should delete mapping by event (eventType + internalEventId)', () => {
      const now = new Date().toISOString();

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-abc', 'to_device', now]
      );

      // Delete by event
      testDb.run(
        'DELETE FROM native_calendar_event_mappings WHERE event_type = ? AND internal_event_id = ?',
        ['rehearsal', '101']
      );

      // Verify deleted
      const mapping = testDb.get(
        'SELECT * FROM native_calendar_event_mappings WHERE event_type = ? AND internal_event_id = ?',
        ['rehearsal', '101']
      );

      expect(mapping).toBeUndefined();
    });

    it('should enforce UNIQUE constraint (connection_id, event_type, internal_event_id)', () => {
      const now = new Date().toISOString();

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-1', 'to_device', now]
      );

      // Try to insert duplicate
      expect(() => {
        testDb.run(
          `INSERT INTO native_calendar_event_mappings
           (connection_id, event_type, internal_event_id, external_event_id,
            last_sync_direction, last_sync_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [connectionId, 'rehearsal', '101', 'ext-event-2', 'to_device', now]
        );
      }).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe('CASCADE Deletion - Connection → Mappings', () => {
    it('should CASCADE delete mappings when connection is deleted', () => {
      const now = new Date().toISOString();

      // Create connection
      const connectionResult = testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'cal-123', 'My Calendar', 1, 'bidirectional', now, now]
      );

      const connectionId = connectionResult.lastInsertId;

      // Create multiple mappings for this connection
      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '101', 'ext-event-1', 'to_device', now]
      );

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'rehearsal', '102', 'ext-event-2', 'to_device', now]
      );

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [connectionId, 'availability', '201', 'ext-event-3', 'from_device', now]
      );

      // Verify 3 mappings exist
      const mappingsBefore = testDb.all(
        'SELECT * FROM native_calendar_event_mappings WHERE connection_id = ?',
        [connectionId]
      );

      expect(mappingsBefore).toHaveLength(3);

      // Delete connection - should CASCADE to mappings
      testDb.run('DELETE FROM native_calendar_connections WHERE id = ?', [connectionId]);

      // Verify connection deleted
      const connection = testDb.get('SELECT * FROM native_calendar_connections WHERE id = ?', [
        connectionId,
      ]);

      expect(connection).toBeUndefined();

      // Verify mappings CASCADED (deleted)
      const mappingsAfter = testDb.all(
        'SELECT * FROM native_calendar_event_mappings WHERE connection_id = ?',
        [connectionId]
      );

      expect(mappingsAfter).toHaveLength(0);
    });
  });

  describe('Multi-User Isolation', () => {
    it('should keep connections separate per user', () => {
      const now = new Date().toISOString();

      // Admin creates connection
      testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'admin-cal', 'Admin Calendar', 1, 'bidirectional', now, now]
      );

      // Member creates connection
      testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testData.memberId,
          'google',
          'member-cal',
          'Member Calendar',
          1,
          'bidirectional',
          now,
          now,
        ]
      );

      // Get admin connections
      const adminConnections = testDb.all(
        'SELECT * FROM native_calendar_connections WHERE user_id = ?',
        [testData.adminId]
      );

      expect(adminConnections).toHaveLength(1);
      expect(adminConnections[0].device_calendar_id).toBe('admin-cal');

      // Get member connections
      const memberConnections = testDb.all(
        'SELECT * FROM native_calendar_connections WHERE user_id = ?',
        [testData.memberId]
      );

      expect(memberConnections).toHaveLength(1);
      expect(memberConnections[0].device_calendar_id).toBe('member-cal');
    });

    it('should prevent cross-user access through JOIN on mappings', () => {
      const now = new Date().toISOString();

      // Create connections for both users
      const adminConnectionResult = testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [testData.adminId, 'apple', 'admin-cal', 'Admin Calendar', 1, 'bidirectional', now, now]
      );

      const memberConnectionResult = testDb.run(
        `INSERT INTO native_calendar_connections
         (user_id, provider, device_calendar_id, device_calendar_name,
          sync_enabled, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testData.memberId,
          'google',
          'member-cal',
          'Member Calendar',
          1,
          'bidirectional',
          now,
          now,
        ]
      );

      const adminConnectionId = adminConnectionResult.lastInsertId;
      const memberConnectionId = memberConnectionResult.lastInsertId;

      // Create mappings for both
      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [adminConnectionId, 'rehearsal', '101', 'admin-event-1', 'to_device', now]
      );

      testDb.run(
        `INSERT INTO native_calendar_event_mappings
         (connection_id, event_type, internal_event_id, external_event_id,
          last_sync_direction, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [memberConnectionId, 'rehearsal', '102', 'member-event-1', 'to_device', now]
      );

      // Get admin's mappings through JOIN (ownership check)
      const adminMappings = testDb.all(
        `SELECT m.*
         FROM native_calendar_event_mappings m
         JOIN native_calendar_connections c ON m.connection_id = c.id
         WHERE c.user_id = ?`,
        [testData.adminId]
      );

      expect(adminMappings).toHaveLength(1);
      expect(adminMappings[0].external_event_id).toBe('admin-event-1');

      // Get member's mappings through JOIN (ownership check)
      const memberMappings = testDb.all(
        `SELECT m.*
         FROM native_calendar_event_mappings m
         JOIN native_calendar_connections c ON m.connection_id = c.id
         WHERE c.user_id = ?`,
        [testData.memberId]
      );

      expect(memberMappings).toHaveLength(1);
      expect(memberMappings[0].external_event_id).toBe('member-event-1');
    });
  });
});
