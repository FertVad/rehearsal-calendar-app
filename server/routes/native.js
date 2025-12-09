import { Router } from 'express';
import availabilityRoutes from './native/availability.js';
import projectsRoutes from './native/projects.js';
import membersRoutes from './native/members.js';
import rehearsalsRoutes from './native/rehearsals.js';
import invitesRoutes from './native/invites.js';

/**
 * Router for React Native app endpoints (non-Telegram)
 * These endpoints work with regular user accounts (email/password)
 *
 * The routes are organized into separate modules:
 * - availability.js: User availability management (GET/POST/PUT/DELETE /availability)
 * - projects.js: Project CRUD operations (GET/POST /projects)
 * - members.js: Project members and their availability (GET /projects/:id/members)
 * - rehearsals.js: Rehearsal management and RSVP (GET/POST/PUT/DELETE /projects/:id/rehearsals, /rehearsals/:id/respond)
 * - invites.js: Project invitation links (GET/POST/DELETE /projects/:id/invite, GET/POST /invite/:code)
 */
const router = Router();

// Mount sub-routers
router.use('/availability', availabilityRoutes);
router.use('/projects', projectsRoutes);
router.use('/projects', membersRoutes);
router.use('/projects', rehearsalsRoutes);
router.use('/projects', invitesRoutes);
router.use('/rehearsals', rehearsalsRoutes);
router.use('/invite', invitesRoutes);

export default router;
