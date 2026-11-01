// Keeps a run's screenshot here as evidence: node keep.mjs <from.png> <name.png>
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [from, name] = process.argv.slice(2);
copyFileSync(from, path.join(path.dirname(fileURLToPath(import.meta.url)), path.basename(name)));
