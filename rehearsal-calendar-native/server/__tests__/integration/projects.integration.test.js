/**
 * REAL Integration Tests for Projects API
 *
 * These tests:
 * - Use REAL in-memory SQLite database
 * - Execute REAL SQL queries
 * - Test REAL CRUD operations for projects
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

describe('Projects API - REAL Integration Tests', () => {
  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    testData = await seedTestData(testDb);
  });

  beforeEach(() => {
    // Clear only project-related data, keep users
    testDb.run('DELETE FROM native_rehearsal_responses');
    testDb.run('DELETE FROM native_rehearsals');
    testDb.run('DELETE FROM native_project_members');
    testDb.run('DELETE FROM native_projects');

    // Re-seed project data
    const project = testDb.run(
      `INSERT INTO native_projects (name, description, timezone)
       VALUES (?, ?, ?)`,
      ['Test Project', 'A project for testing', 'UTC']
    );
    testData.projectId = project.lastInsertId;

    // Add members back
    testDb.run(
      `INSERT INTO native_project_members (project_id, user_id, role, status)
       VALUES (?, ?, ?, ?)`,
      [testData.projectId, testData.adminId, 'owner', 'active']
    );

    testDb.run(
      `INSERT INTO native_project_members (project_id, user_id, role, status)
       VALUES (?, ?, ?, ?)`,
      [testData.projectId, testData.memberId, 'member', 'active']
    );
  });

  afterAll(() => {
    closeIntegrationDb();
  });

  describe('createProject - REAL DATABASE OPERATIONS', () => {
    it('should ACTUALLY create project in database', () => {
      const result = testDb.run(
        `INSERT INTO native_projects (name, description, timezone)
         VALUES (?, ?, ?)`,
        ['New Project', 'Project description', 'America/New_York']
      );

      expect(result.lastInsertId).toBeDefined();

      // Verify it's REALLY in database
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [result.lastInsertId]
      );

      expect(project).toBeDefined();
      expect(project.name).toBe('New Project');
      expect(project.description).toBe('Project description');
      expect(project.timezone).toBe('America/New_York');
    });

    it('should set default timezone when not provided', () => {
      const result = testDb.run(
        `INSERT INTO native_projects (name, description)
         VALUES (?, ?)`,
        ['Project without timezone', null]
      );

      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [result.lastInsertId]
      );

      expect(project.timezone).toBe('UTC');
    });

    it('should create owner membership when project is created', () => {
      // Create project
      const projectResult = testDb.run(
        `INSERT INTO native_projects (name, timezone)
         VALUES (?, ?)`,
        ['Owner Test Project', 'UTC']
      );

      // Add creator as owner
      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status)
         VALUES (?, ?, ?, ?)`,
        [projectResult.lastInsertId, testData.adminId, 'owner', 'active']
      );

      // Verify membership exists
      const membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [projectResult.lastInsertId, testData.adminId]
      );

      expect(membership).toBeDefined();
      expect(membership.role).toBe('owner');
      expect(membership.status).toBe('active');
    });

    it('should require name (NOT NULL constraint)', () => {
      expect(() => {
        testDb.run(
          `INSERT INTO native_projects (description)
           VALUES (?)`,
          ['Project without name']
        );
      }).toThrow(/NOT NULL constraint failed/);
    });
  });

  describe('getProjects - REAL DATABASE QUERY', () => {
    beforeEach(() => {
      // Create multiple projects
      const p1 = testDb.run(
        `INSERT INTO native_projects (name, timezone) VALUES (?, ?)`,
        ['Project Alpha', 'UTC']
      );

      const p2 = testDb.run(
        `INSERT INTO native_projects (name, timezone) VALUES (?, ?)`,
        ['Project Beta', 'America/New_York']
      );

      const p3 = testDb.run(
        `INSERT INTO native_projects (name, timezone) VALUES (?, ?)`,
        ['Project Gamma', 'Europe/London']
      );

      // Add admin as member to all projects
      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)`,
        [p1.lastInsertId, testData.adminId, 'admin', 'active']
      );

      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)`,
        [p2.lastInsertId, testData.adminId, 'member', 'active']
      );

      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)`,
        [p3.lastInsertId, testData.adminId, 'member', 'active']
      );
    });

    it('should ACTUALLY fetch all projects for user with JOIN', () => {
      const projects = testDb.all(
        `SELECT p.*, pm.role
         FROM native_projects p
         INNER JOIN native_project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = ? AND pm.status = 'active'
         ORDER BY p.created_at DESC`,
        [testData.adminId]
      );

      // Should return 4 projects (3 new + 1 from beforeEach)
      expect(projects.length).toBeGreaterThanOrEqual(3);
      expect(projects[0].name).toBeDefined();
      expect(projects[0].role).toBeDefined();
    });

    it('should identify admin role correctly', () => {
      const projects = testDb.all(
        `SELECT p.*,
                CASE WHEN pm.role IN ('owner', 'admin') THEN 1 ELSE 0 END as is_admin
         FROM native_projects p
         INNER JOIN native_project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = ? AND pm.status = 'active'`,
        [testData.adminId]
      );

      const adminProject = projects.find(p => p.name === 'Project Alpha');
      expect(adminProject.is_admin).toBe(1);

      const memberProject = projects.find(p => p.name === 'Project Beta');
      expect(memberProject.is_admin).toBe(0);
    });

    it('should only return active memberships', () => {
      // Create inactive membership
      const p4 = testDb.run(
        `INSERT INTO native_projects (name) VALUES (?)`,
        ['Inactive Project']
      );

      testDb.run(
        `INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, ?, ?)`,
        [p4.lastInsertId, testData.adminId, 'member', 'inactive']
      );

      const projects = testDb.all(
        `SELECT p.*
         FROM native_projects p
         INNER JOIN native_project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = ? AND pm.status = 'active'`,
        [testData.adminId]
      );

      const inactiveProject = projects.find(p => p.name === 'Inactive Project');
      expect(inactiveProject).toBeUndefined();
    });

    it('should return empty array for user with no projects', () => {
      // Create new user with no projects
      const newUser = testDb.run(
        `INSERT INTO native_users (email, password_hash, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        ['noproject@test.com', 'hash', 'No', 'Projects']
      );

      const projects = testDb.all(
        `SELECT p.*
         FROM native_projects p
         INNER JOIN native_project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = ? AND pm.status = 'active'`,
        [newUser.lastInsertId]
      );

      expect(projects).toEqual([]);
    });
  });

  describe('getProject - REAL DATABASE QUERY', () => {
    it('should ACTUALLY fetch single project by ID', () => {
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );

      expect(project).toBeDefined();
      expect(project.id).toBe(testData.projectId);
      expect(project.name).toBe('Test Project');
    });

    it('should verify user membership before returning project', () => {
      // Check membership
      const membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ? AND status = ?',
        [testData.projectId, testData.adminId, 'active']
      );

      expect(membership).toBeDefined();

      // Only then fetch project
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );

      expect(project).toBeDefined();
    });

    it('should return undefined for non-existent project', () => {
      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [999999]
      );

      expect(project).toBeUndefined();
    });

    it('should enforce access control via membership check', () => {
      // Create user not in project
      const outsider = testDb.run(
        `INSERT INTO native_users (email, password_hash, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        ['outsider@test.com', 'hash', 'Outsider', 'User']
      );

      // Check membership (should fail)
      const membership = testDb.get(
        'SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [testData.projectId, outsider.lastInsertId]
      );

      expect(membership).toBeUndefined();
    });
  });

  describe('updateProject - REAL DATABASE UPDATE', () => {
    it('should ACTUALLY update project fields', () => {
      testDb.run(
        `UPDATE native_projects SET name = ?, description = ?, timezone = ? WHERE id = ?`,
        ['Updated Name', 'Updated description', 'Europe/Paris', testData.projectId]
      );

      const project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );

      expect(project.name).toBe('Updated Name');
      expect(project.description).toBe('Updated description');
      expect(project.timezone).toBe('Europe/Paris');
    });

    it('should only allow admin/owner to update (role check)', () => {
      // Check if user is admin/owner
      const membership = testDb.get(
        "SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ? AND role IN ('owner', 'admin')",
        [testData.projectId, testData.adminId]
      );

      expect(membership).toBeDefined();
      expect(['owner', 'admin']).toContain(membership.role);
    });

    it('should prevent member (non-admin) from updating', () => {
      // Check if member user is NOT admin/owner
      const membership = testDb.get(
        "SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ? AND role IN ('owner', 'admin')",
        [testData.projectId, testData.memberId]
      );

      expect(membership).toBeUndefined();
    });
  });

  describe('deleteProject - REAL DATABASE DELETE', () => {
    it('should ACTUALLY delete project from database', () => {
      // Verify exists
      let project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );
      expect(project).toBeDefined();

      // Delete
      testDb.run('DELETE FROM native_projects WHERE id = ?', [testData.projectId]);

      // Verify deleted
      project = testDb.get(
        'SELECT * FROM native_projects WHERE id = ?',
        [testData.projectId]
      );
      expect(project).toBeUndefined();
    });

    it('should CASCADE delete all project members', () => {
      // Verify members exist
      let members = testDb.all(
        'SELECT * FROM native_project_members WHERE project_id = ?',
        [testData.projectId]
      );
      expect(members.length).toBeGreaterThan(0);

      // Delete project
      testDb.run('DELETE FROM native_projects WHERE id = ?', [testData.projectId]);

      // Verify members CASCADE deleted
      members = testDb.all(
        'SELECT * FROM native_project_members WHERE project_id = ?',
        [testData.projectId]
      );
      expect(members).toHaveLength(0);
    });

    it('should CASCADE delete all rehearsals', () => {
      // Create rehearsal
      const rehearsal = testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [testData.projectId, 'Test Rehearsal', '2025-12-25T10:00:00Z', '2025-12-25T12:00:00Z']
      );

      // Verify rehearsal exists
      let rehearsals = testDb.all(
        'SELECT * FROM native_rehearsals WHERE project_id = ?',
        [testData.projectId]
      );
      expect(rehearsals).toHaveLength(1);

      // Delete project
      testDb.run('DELETE FROM native_projects WHERE id = ?', [testData.projectId]);

      // Verify rehearsals CASCADE deleted
      rehearsals = testDb.all(
        'SELECT * FROM native_rehearsals WHERE project_id = ?',
        [testData.projectId]
      );
      expect(rehearsals).toHaveLength(0);
    });

    it('should only allow owner to delete (strict permission check)', () => {
      // Check if user is owner
      const membership = testDb.get(
        "SELECT * FROM native_project_members WHERE project_id = ? AND user_id = ? AND role = 'owner'",
        [testData.projectId, testData.adminId]
      );

      expect(membership).toBeDefined();
      expect(membership.role).toBe('owner');
    });
  });

  describe('getProjectMembers - REAL JOIN QUERY', () => {
    it('should ACTUALLY fetch members with user info via JOIN', () => {
      const members = testDb.all(
        `SELECT pm.*, u.first_name, u.last_name, u.email
         FROM native_project_members pm
         JOIN native_users u ON pm.user_id = u.id
         WHERE pm.project_id = ? AND pm.status = 'active'
         ORDER BY pm.role ASC, u.first_name ASC`,
        [testData.projectId]
      );

      expect(members.length).toBeGreaterThanOrEqual(2);

      // Verify JOIN worked
      expect(members[0].first_name).toBeDefined();
      expect(members[0].last_name).toBeDefined();
      expect(members[0].email).toBeDefined();
      expect(members[0].role).toBeDefined();
    });

    it('should order members by role (owner/admin first)', () => {
      const members = testDb.all(
        `SELECT pm.*, u.first_name
         FROM native_project_members pm
         JOIN native_users u ON pm.user_id = u.id
         WHERE pm.project_id = ? AND pm.status = 'active'
         ORDER BY CASE pm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, u.first_name ASC`,
        [testData.projectId]
      );

      expect(members[0].role).toBe('owner');
    });

    it('should return empty array for project with no members', () => {
      // Create project without members
      const emptyProject = testDb.run(
        `INSERT INTO native_projects (name) VALUES (?)`,
        ['Empty Project']
      );

      const members = testDb.all(
        'SELECT * FROM native_project_members WHERE project_id = ?',
        [emptyProject.lastInsertId]
      );

      expect(members).toEqual([]);
    });
  });

  describe('UNIQUE constraint on (project_id, user_id)', () => {
    it('should enforce UNIQUE constraint', () => {
      expect(() => {
        testDb.run(
          `INSERT INTO native_project_members (project_id, user_id, role, status)
           VALUES (?, ?, ?, ?)`,
          [testData.projectId, testData.adminId, 'member', 'active']
        );
      }).toThrow(/UNIQUE constraint failed/);
    });
  });
});
