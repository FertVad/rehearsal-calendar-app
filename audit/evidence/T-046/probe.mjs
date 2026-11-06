// T-046 "red before": put dead code into the app and the server, run
// npm run check:dead, take it out again.
//   node ../audit/evidence/T-046/probe.mjs add      (from rehearsal-calendar-native)
//   node ../audit/evidence/T-046/probe.mjs remove
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

const probes = {
  // A file nothing imports.
  'src/shared/utils/t046DeadProbe.ts': '// T-046 probe: a file nothing imports.\nexport const t046DeadProbe = 1;\n',
  'server/utils/t046DeadProbe.js': '// T-046 probe: a file nothing imports.\nexport const t046DeadProbe = 1;\n',
  // A server script nothing runs or imports (scripts/ is not a blanket entry).
  'server/scripts/t046DeadProbe.mjs': '// T-046 probe: a script nothing runs.\nexport const t046DeadProbe = 1;\n',
};

const mode = process.argv[2];
for (const [file, text] of Object.entries(probes)) {
  if (mode === 'add') {
    writeFileSync(file, text);
    console.log('added', file);
  } else if (mode === 'remove') {
    if (existsSync(file)) unlinkSync(file);
    console.log('removed', file);
  } else {
    throw new Error('usage: probe.mjs add|remove');
  }
}
