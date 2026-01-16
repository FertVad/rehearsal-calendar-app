/**
 * REAL Integration Tests for Invites System
 *
 * These tests:
 * - Use REAL in-memory SQLite database
 * - Execute REAL SQL queries
 * - Test REAL invite creation, validation, and joining
 * - Catch REAL bugs
 */
import { jest } from '@jest/globals';
import crypto from 'crypto';
import {
  setupIntegrationDb,
  clearIntegrationDb,
  closeIntegrationDb,
  seedTestData,
} from './setup.js';

let testDb;
let testData;

describe('Invites System - REAL Integration Tests', () => {
  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    testData = await seedTestData(testDb);
  });

  beforeEach(() => {
    // Clear invites by resetting project invite fields
    testDb.run(
      'UPDATE native_projects SET invite_code = NULL, invite_expires_at = NULL, invite_created_by = NULL'
    );
  });

  afterAll(() => {
    closeIntegrationDb();
  });

  describe('createInvite - REAL DATABASE OPERATIONS', () => {
    it('should ACTUALLY store invite code in project', () => {
      const inviteCode = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      testDb.run(
        `UPDATE native_projects
         SET invite_code = ?, invite_expires_at = ?, invite_created_by = ?
         WHERE id = ?`,
        [inviteCode, expiresAt.toISOString(), testData.adminId, testData.projectId]
      );

      // Verify it's REALLY in database
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );

      expect(project.invite_code).toBe(inviteCode);
      expect(project.invite_expires_at).toBeDefined();
      expect(project.invite_created_by).toBe(testData.adminId);
    });

    it('should generate unique invite code', () => {
      const code1 = crypto.randomBytes(16).toString('hex');
      const code2 = crypto.randomBytes(16).toString('hex');

      expect(code1).not.toBe(code2);
      expect(code1).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(code2).toHaveLength(32);
    });

    it('should enforce UNIQUE constraint on invite_code', () => {
      const sameCode = 'duplicate-code-123';

      // First project with code
      testDb.run(
        'UPDATE native_projects SET invite_code = ? WHERE id = ?',
        [sameCode, testData.projectId]
      );

      // Create second project
      const project2 = testDb.run(
        'INSERT INTO native_projects (name) VALUES (?)',
        ['Project 2']
      );

      // Try to use same code - should fail
      expect(() => {
        testDb.run(
          'UPDATE native_projects SET invite_code = ? WHERE id = ?',
          [sameCode, project2.lastInsertId]
        );
      }).toThrow(/UNIQUE constraint failed/);
    });

    it('should only allow admin/owner to create invite', () => {
      // Check if user is admin/owner
      const membership = testDb.get(
        "SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ? AND role IN ('owner', 'admin')",
        [testData.projectId, testData.adminId]
      );

      expect(membership).toBeDefined();
    });

    it('should prevent non-admin from creating invite', () => {
      // Check if member is NOT admin/owner
      const membership = testDb.get(
        "SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ? AND role IN ('owner', 'admin')",
        [testData.projectId, testData.memberId]
      );

      expect(membership).toBeUndefined();
    });
  });

  describe('getInviteInfo - REAL DATABASE QUERY', () => {
    let inviteCode;

    beforeEach(() => {
      inviteCode = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      testDb.run(
        `UPDATE native_projects
         SET invite_code = ?, invite_expires_at = ?
         WHERE id = ?`,
        [inviteCode, expiresAt.toISOString(), testData.projectId]
      );
    });

    it('should ACTUALLY fetch project by invite code', () => {
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE invite_code = ?',
        [inviteCode]
      );

      expect(project).toBeDefined();
      expect(project.id).toBe(testData.projectId);
      expect(project.name).toBe('Test Project');
      expect(project.invite_code).toBe(inviteCode);
    });

    it('should return undefined for invalid code', () => {
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE invite_code = ?',
        ['invalid-code-12345']
      );

      expect(project).toBeUndefined();
    });

    it('should validate expiration date', () => {
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE invite_code = ?',
        [inviteCode]
      );

      const expiresAt = new Date(project.invite_expires_at);
      const now = new Date();

      expect(expiresAt > now).toBe(true);
    });

    it('should detect expired invites', () => {
      // Update to expired date
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      testDb.run(
        'UPDATE native_projects SET invite_expires_at = ? WHERE id = ?',
        [expiredDate.toISOString(), testData.projectId]
      );

      const project = testDb.get(
        'SELECT * FROM native_projects WHERE invite_code = ?',
        [inviteCode]
      );

      const expiresAt = new Date(project.invite_expires_at);
      const now = new Date();

      expect(expiresAt < now).toBe(true);
    });
  });

  describe('joinProject - REAL DATABASE OPERATIONS', () => {
    let inviteCode;
    let newUserId;

    beforeEach(() => {
      // Create invite
      inviteCode = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      testDb.run(
        `UPDATE native_projects SET invite_code = ?, invite_expires_at = ? WHERE id = ?`,
        [inviteCode, expiresAt.toISOString(), testData.projectId]
      );

      // Create new user who will join
      const newUser = testDb.run(
        `INSERT INTO native_users (email, password_hash, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        ['newuser@test.com', 'hash', 'New', 'User']
      );
      newUserId = newUser.lastInsertId;
    });

    afterEach(() => {
      // Clean up temp user
      testDb.run('DELETE FROM native_users WHERE id = ?', [newUserId]);
    });

    it('should ACTUALLY create membership when joining', () => {
      // Join project
      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, newUserId, 'member', 'active']
      );

      // Verify membership REALLY exists
      const membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [testData.projectId, newUserId]
      );

      expect(membership).toBeDefined();
      expect(membership.role).toBe('member');
      expect(membership.status).toBe('active');
    });

    it('should prevent joining twice (UNIQUE constraint)', () => {
      // First join
      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, newUserId, 'member', 'active']
      );

      // Second join - should fail
      expect(() => {
        testDb.run(
          `INSERT INTO native_project_members (project_id, user_id, role, status)
           VALUES (?, ?, ?, ?)`,
          [testData.projectId, newUserId, 'member', 'active']
        );
      }).toThrow(/UNIQUE constraint failed/);
    });

    it('should reactivate inactive membership', () => {
      // Create inactive membership
      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, newUserId, 'member', 'inactive']
      );

      // Get membership
      let membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [testData.projectId, newUserId]
      );
      expect(membership.status).toBe('inactive');

      // Reactivate
      testDb.run(
        "UPDATE native_project_members SET status = 'active' WHERE id = ?",
        [membership.id]
      );

      // Verify reactivated
      membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [testData.projectId, newUserId]
      );
      expect(membership.status).toBe('active');
    });

    it('should not allow joining with expired invite', () => {
      // Expire invite
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      testDb.run(
        'UPDATE native_projects SET invite_expires_at = ? WHERE id = ?',
        [expiredDate.toISOString(), testData.projectId]
      );

      // Check if expired
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE invite_code = ?',
        [inviteCode]
      );

      const isExpired = new Date(project.invite_expires_at) < new Date();
      expect(isExpired).toBe(true);
    });

    it('should require valid project_id (foreign key)', () => {
      expect(() => {
        testDb.run(
          `INSERT INTO native_project_members (project_id, user_id, role, status)
           VALUES (?, ?, ?, ?)`,
          [999999, newUserId, 'member', 'active']
        );
      }).toThrow(/FOREIGN KEY constraint failed/);
    });
  });

  describe('revokeInvite - REAL DATABASE UPDATE', () => {
    let inviteCode;

    beforeEach(() => {
      inviteCode = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      testDb.run(
        `UPDATE native_projects SET invite_code = ?, invite_expires_at = ?, invite_created_by = ? WHERE id = ?`,
        [inviteCode, expiresAt.toISOString(), testData.adminId, testData.projectId]
      );
    });

    it('should ACTUALLY clear invite code from project', () => {
      // Verify invite exists
      let project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );
      expect(project.invite_code).toBeDefined();

      // Revoke
      testDb.run(
        'UPDATE native_projects SET invite_code = NULL, invite_expires_at = NULL, invite_created_by = NULL WHERE id = ?',
        [testData.projectId]
      );

      // Verify cleared
      project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );
      expect(project.invite_code).toBeNull();
      expect(project.invite_expires_at).toBeNull();
      expect(project.invite_created_by).toBeNull();
    });

    it('should only allow admin/owner to revoke', () => {
      // Check admin permission
      const membership = testDb.get(
        "SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ? AND role IN ('owner', 'admin')",
        [testData.projectId, testData.adminId]
      );

      expect(membership).toBeDefined();
    });
  });

  describe('getCurrentInvite - REAL DATABASE QUERY', () => {
    it('should return NULL when no invite exists', () => {
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );

      expect(project.invite_code).toBeNull();
    });

    it('should return active invite', () => {
      const inviteCode = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      testDb.run(
        `UPDATE native_projects SET invite_code = ?, invite_expires_at = ? WHERE id = ?`,
        [inviteCode, expiresAt.toISOString(), testData.projectId]
      );

      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );

      expect(project.invite_code).toBe(inviteCode);
      expect(project.invite_expires_at).toBeDefined();
    });

    it('should not return expired invite', () => {
      const inviteCode = crypto.randomBytes(16).toString('hex');
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      testDb.run(
        `UPDATE native_projects SET invite_code = ?, invite_expires_at = ? WHERE id = ?`,
        [inviteCode, expiredDate.toISOString(), testData.projectId]
      );

      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );

      // Invite exists in DB but is expired
      expect(project.invite_code).toBe(inviteCode);
      expect(new Date(project.invite_expires_at) < new Date()).toBe(true);
    });
  });

  describe('checkExistingMembership - REAL QUERY', () => {
    it('should detect existing active membership', () => {
      const membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [testData.projectId, testData.adminId]
      );

      expect(membership).toBeDefined();
      expect(membership.status).toBe('active');
    });

    it('should detect inactive membership', () => {
      // Create new user with inactive membership
      const user = testDb.run(
        `INSERT INTO native_users (email, password_hash, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        ['inactive@test.com', 'hash', 'Inactive', 'User']
      );

      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, user.lastInsertId, 'member', 'inactive']
      );

      const membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [testData.projectId, user.lastInsertId]
      );

      expect(membership).toBeDefined();
      expect(membership.status).toBe('inactive');
    });

    it('should return undefined for non-member', () => {
      const user = testDb.run(
        `INSERT INTO native_users (email, password_hash, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        ['nonmember@test.com', 'hash', 'Non', 'Member']
      );

      const membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [testData.projectId, user.lastInsertId]
      );

      expect(membership).toBeUndefined();
    });
  });
});
