// Removes the director-only flow used once for the "before" screenshot.
import { unlinkSync, existsSync } from 'node:fs';

const temp = 'e2e/flows/tmp-72-director.yaml';
if (existsSync(temp)) unlinkSync(temp);
console.log(existsSync(temp) ? 'still there' : 'removed');
