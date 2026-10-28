import { Router } from 'express';
import availabilityRoutes from './native/availability.js';
import projectsRoutes from './native/projects.js';
import membersRoutes from './native/members.js';
import rehearsalsRoutes from './native/rehearsals.js';
import projectInvitesRoutes from './native/projectInvites.js';
import inviteRedemptionRoutes, { legacyProjectInviteRedemptionRouter } from './native/inviteRedemption.js';
import bugReportsRoutes from './native/bugReports.js';
import notificationsRoutes from './native/notifications.js';

/**
 * Router for React Native app endpoints (non-Telegram)
 * These endpoints work with regular user accounts (email/password)
 *
 * The routes are organized into separate modules:
 * - availability.js: User availability management (GET/POST/DELETE /availability)
 * - projects.js: Project CRUD operations (GET/POST /projects)
 * - members.js: Project members and their availability (GET /projects/:id/members)
 * - rehearsals.js: Rehearsal management and RSVP (GET/POST/PUT/DELETE /projects/:id/rehearsals, /rehearsals/:id/respond)
 * - projectInvites.js: Admin management (GET/POST/DELETE /projects/:id/invite)
 * - inviteRedemption.js: Public preview and authenticated redemption (/invite/:code)
 * - notifications.js: The user's notification inbox (GET /notifications, POST /notifications/read)
 */
const router = Router();

// Mount sub-routers
router.use('/availability', availabilityRoutes);
router.use('/projects', projectsRoutes);
router.use('/projects', membersRoutes);
router.use('/projects', rehearsalsRoutes);
router.use('/projects', projectInvitesRoutes);
router.use('/projects', legacyProjectInviteRedemptionRouter);
router.use('/rehearsals', rehearsalsRoutes);
router.use('/invite', inviteRedemptionRoutes);
// Preserve existing management aliases explicitly, with the same admin policy.
router.use('/invite', projectInvitesRoutes);
router.use('/bug-reports', bugReportsRoutes);
router.use('/notifications', notificationsRoutes);

export default router;
