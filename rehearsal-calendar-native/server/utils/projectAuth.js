import db from '../database/db.js';

/**
 * Returns the membership row if user is an active owner/admin of the project,
 * or null otherwise.
 */
export async function getActiveAdminMembership(projectId, userId) {
  return db.get(
    `SELECT * FROM native_project_members
     WHERE project_id = $1 AND user_id = $2
       AND role IN ('owner', 'admin') AND status = 'active'`,
    [projectId, userId]
  );
}
