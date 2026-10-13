/**
 * The order of locks between a project's writers (R4, cause fix 10: B01, B02, D03).
 *
 * A transaction keeps each operation whole, but not two operations apart. A
 * rehearsal being created reads its roster, then books a busy slot for each
 * person; a member removed in between had their slots cleared before the new
 * ones existed, and kept a busy hour for a project they had left. A project
 * deleted while a rehearsal was being created cleared the slots it could see,
 * then cascaded the rehearsal it could not — and its slots stayed forever.
 *
 * The rule, the first statement of every such transaction:
 * - whoever writes a project's rehearsals — create, edit, delete — holds the
 *   project row FOR SHARE: they run alongside each other;
 * - whoever takes people or the project away — removing a member (FOR NO KEY
 *   UPDATE), deleting the project (FOR UPDATE) — holds it exclusively, so they
 *   wait for every writer in flight and every later writer waits for them.
 * A rehearsal row, when one is needed, is locked after the project, never before.
 *
 * FOR NO KEY UPDATE for a removal: it does not wait on the FOR KEY SHARE a
 * foreign key takes, so someone joining the project is not held up by it.
 */

const MODES = {
  write: 'FOR SHARE',
  remove: 'FOR NO KEY UPDATE',
  delete: 'FOR UPDATE',
};

/**
 * Lock the project row in this transaction. Returns false when the project is
 * gone — deleted, perhaps, by the transaction this one waited for.
 */
export async function lockProject(tx, projectId, mode) {
  const row = await tx.get(`SELECT id FROM native_projects WHERE id = $1 ${MODES[mode]}`, [projectId]);
  return Boolean(row);
}
