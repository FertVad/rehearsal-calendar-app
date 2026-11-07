// T-042: unused StyleSheet keys and unused locals in the client, via the
// project's own ESLint config. Prints "file:line rule message" one per line.
// Usage: node lint-unused.mjs rehearsal-calendar-native
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const require = createRequire(path.join(root, 'package.json'));
const { ESLint } = require('eslint');

const eslint = new ESLint({ cwd: root, overrideConfigFile: path.join(root, 'eslint.config.js') });
const results = await eslint.lintFiles(['src/**/*.{ts,tsx,js}', 'App.tsx', 'index.ts']);
const wanted = new Set(['react-native/no-unused-styles', '@typescript-eslint/no-unused-vars']);
let n = 0;
for (const r of results) {
  for (const m of r.messages) {
    if (!wanted.has(m.ruleId)) continue;
    n++;
    console.log(`${path.relative(root, r.filePath)}:${m.line} ${m.ruleId} ${m.message}`);
  }
}
console.log(`total ${n}`);
