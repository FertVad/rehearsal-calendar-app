// Copies a flow's screenshot into this folder: node copy-shot.mjs <from> <name>
import { copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [from, name] = process.argv.slice(2);
copyFileSync(from, join(dirname(fileURLToPath(import.meta.url)), name));
console.log(`copied ${name}`);
