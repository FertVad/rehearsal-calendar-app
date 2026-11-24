#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCLI } from '../database/migrations/cli.mjs';

// Importing this entrypoint is inert; migration is always an explicit operation.
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await runCLI();
}
