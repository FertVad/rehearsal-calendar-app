/**
 * Optional, explicitly selected local environment file. Import before modules
 * that capture environment configuration. With no SERVER_ENV_FILE, only the
 * process environment is used: server/.env is never discovered implicitly.
 * Vercel provides process.env directly and needs no file.
 */
import path from 'node:path';
import dotenv from 'dotenv';

if (process.env.SERVER_ENV_FILE !== undefined) {
  const file = process.env.SERVER_ENV_FILE;
  if (!file || !path.isAbsolute(file)) {
    throw new Error('SERVER_ENV_FILE must be an explicit absolute path');
  }
  const result = dotenv.config({ path: file, quiet: true });
  if (result.error) throw new Error('Unable to load the explicitly selected server environment file');
}
