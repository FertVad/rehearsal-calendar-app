// T-043: unused imports and locals in the server, via the project's own ESLint
// config (no-unused-vars). Prints "file:line rule message" one per line.
// Usage: node lint-unused.mjs rehearsal-calendar-native
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const require = createRequire(path.join(root, 'package.json'));
const { ESLint } = require('eslint');

const eslint = new ESLint({ cwd: root, overrideConfigFile: path.join(root, 'eslint.config.js') });
// server/node_modules is ignored by the config; public/ is not server code.
const all = await eslint.lintFiles(['server/**/*.js']);
const results = all.filter(r => !/[\\/]server[\\/](public|migrations)[\\/]/.test(r.filePath));
const wanted = new Set(['no-unused-vars', '@typescript-eslint/no-unused-vars']);
let n = 0;
for (const r of results) {
  for (const m of r.messages) {
    if (!wanted.has(m.ruleId)) continue;
    n++;
    console.log(`${path.relative(root, r.filePath)}:${m.line} ${m.ruleId} ${m.message}`);
  }
}
console.log(`total ${n}`);
