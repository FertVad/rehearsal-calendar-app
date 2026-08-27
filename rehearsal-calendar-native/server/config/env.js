/**
 * Loads server/.env, and does it early enough to matter.
 *
 * server.js used to call dotenv.config() in its body, after its imports. In ESM
 * every imported module is evaluated before the importing module's first
 * statement runs, so anything reading process.env at module scope — jwtMiddleware
 * captures JWT_SECRET that way — saw an empty environment and fell back to its
 * development default. The .env value was inert locally, and the only sign was a
 * warning nobody connected to the cause.
 *
 * Production was never affected: Vercel puts its variables in process.env before
 * the function starts. That is precisely what made it easy to miss.
 *
 * Import this first, before anything else, in any entry point.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });
