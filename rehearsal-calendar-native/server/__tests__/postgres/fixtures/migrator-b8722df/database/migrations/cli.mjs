import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseArguments, runMigrations, loadArtifacts, MigrationError } from './core.mjs';

export async function runCLI({ argv = process.argv.slice(2), env = process.env,
  emit = value => process.stdout.write(`${JSON.stringify(value)}\n`),
  loadBundle = () => import('../schema/manifest.mjs'),
  artifactRoot = fileURLToPath(new URL('../../', import.meta.url)) } = {}) {
  try {
    // Parsing/help precede even the explicit environment-file read or bundle load.
    const request = parseArguments(argv);
    if (request.mode === 'help') {
      emit({ type: 'usage', modes: ['--apply', '--dry', '--fresh', '--adopt PROFILE', '--help'],
        schemaEnvironment: 'MIGRATION_SCHEMA', environmentFile: 'SERVER_ENV_FILE' });
      return 0;
    }
    let selected = { ...env };
    if (selected.SERVER_ENV_FILE !== undefined) {
      if (!selected.SERVER_ENV_FILE || !path.isAbsolute(selected.SERVER_ENV_FILE)) throw new MigrationError('CONFIG_INVALID', 2);
      try { selected = { ...dotenv.parse(await readFile(selected.SERVER_ENV_FILE)), ...selected }; }
      catch { throw new MigrationError('CONFIG_INVALID', 2); }
    }
    const connectionString = selected.DATABASE_URL || selected.POSTGRES_URL;
    const schema = selected.MIGRATION_SCHEMA ?? 'public';
    if (typeof connectionString !== 'string' || !connectionString.trim()) throw new MigrationError('CONFIG_INVALID', 2);
    const { manifest, inspectSchema } = await loadBundle();
    const artifacts = await loadArtifacts(manifest, artifactRoot);
    const result = await runMigrations({ connectionString, schema, request, artifacts, inspectSchema });
    emit({ type: 'result', mode: request.mode, ...result });
    return 0;
  } catch (error) {
    const known = error instanceof MigrationError;
    emit({ type: 'error', code: known ? error.code : 'MIGRATION_FAILED',
      ...(known && error.diagnostics ? { diagnostics: error.diagnostics } : {}) });
    return known ? error.exitCode : 1;
  }
}
