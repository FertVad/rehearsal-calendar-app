-- 015: no notice keeps a name it cannot be traced to (T-278). PREPARED, NOT APPLIED.
--
-- Three notices carry a member's name as text into the inboxes of those who
-- run the project: member_joined ("X joined"), admin_appointed ("X is now an
-- administrator") and member_response ("X has seen the rehearsal"). Since
-- T-278 each records whom it names in data.aboutUserId, and deleting an
-- account removes every notice naming it (DELETE /me). The rows written before
-- say nobody: their name cannot be removed when its owner leaves. This deletes
-- them.
--
-- Deleted rather than traced: the name is the only clue, and names are neither
-- unique nor fixed — two members may share one, and anyone may have renamed
-- themselves since. A wrong guess would delete the wrong person's notices or
-- keep the right one's. They are old notices of what has happened; the members
-- list and the rehearsal's answers still show the same today.
--
-- Apply AFTER the T-278 server is deployed, with 014: a row written by the old
-- server between this step and the deploy would again have no mark. Rerun it
-- if in doubt; it is idempotent, and a marked row is never touched.
--
-- Data only, one statement, no transaction control. Not in
-- database/schema/manifest.mjs: the runner executes only structural steps and
-- has no slot for a data step. Applying it to production is the owner's
-- decision (audit/PRODUCTION_ACCESS.md).
DELETE FROM native_notifications
WHERE type IN ('member_joined', 'admin_appointed', 'member_response')
  AND (data IS NULL OR data->>'aboutUserId' IS NULL);
