// T-215: two late-load-repro.mjs runs side by side, A and B, each with the
// same arguments and its lines prefixed by its letter. Each is load for the
// other, as the red run had other work on the machine. Tried once without
// copies of the target (red-before-runs.txt, 7): side by side, neither run got
// past the twelfth file before the target within 595 s.
//
//   node audit/evidence/T-215/late-load-pair.mjs <in-band|one-worker> <burners-per-core> <files-before-target> <deadline s>
//
// Copies of the target (late-load-repro.mjs's fifth argument) are not passed:
// both runs would make and remove the same files.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./late-load-repro.mjs', import.meta.url));
for (const label of ['A', 'B']) {
  const run = spawn(process.execPath, [script, ...process.argv.slice(2, 6)]);
  for (const stream of [run.stdout, run.stderr]) {
    createInterface({ input: stream }).on('line', (line) => console.log(`${label}| ${line}`));
  }
}
