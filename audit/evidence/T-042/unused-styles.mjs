// T-042: StyleSheet.create keys nobody reads, across files.
// Usage: node unused-styles.mjs rehearsal-calendar-native
// For every key of every StyleSheet.create({...}) in src/ (tests excluded),
// asks the TypeScript language service for its references in the whole
// tsconfig program (src with its tests, App.tsx, index.ts). A key whose only
// reference is its own declaration is unused. Files that index a style object
// dynamically (styles[x]) are listed separately, since references cannot see
// through that.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

const configPath = path.join(root, 'tsconfig.json');
const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
const files = parsed.fileNames.filter((f) => !f.includes('node_modules'));
const host = {
  getScriptFileNames: () => files,
  getScriptVersion: () => '0',
  getScriptSnapshot: (f) => (fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined),
  getCurrentDirectory: () => root,
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};
const ls = ts.createLanguageService(host, ts.createDocumentRegistry());
const program = ls.getProgram();

const isTest = (f) => /__tests__|\.test\.|\.spec\./.test(f);
const unused = [];
const dynamic = [];
let keys = 0;

for (const sf of program.getSourceFiles()) {
  const f = sf.fileName;
  if (!f.startsWith(path.join(root, 'src')) || isTest(f)) continue;
  if (/\w*[sS]tyles\s*\[/.test(sf.text)) dynamic.push(path.relative(root, f));
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'create' &&
      node.expression.expression.getText(sf) === 'StyleSheet' &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const prop of node.arguments[0].properties) {
        if (!prop.name) continue;
        keys++;
        const refs = ls.findReferences(f, prop.name.getStart(sf)) ?? [];
        const uses = refs.flatMap((r) => r.references).filter((r) => !r.isDefinition);
        if (uses.length === 0) {
          const { line } = sf.getLineAndCharacterOfPosition(prop.name.getStart(sf));
          unused.push(`${path.relative(root, f)}:${line + 1} ${prop.name.getText(sf)}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

console.log(`StyleSheet keys checked: ${keys}`);
console.log(`Unused keys (${unused.length}):`);
for (const u of unused) console.log(`  ${u}`);
console.log(`Files indexing a styles object dynamically (${dynamic.length}):`);
for (const d of dynamic) console.log(`  ${d}`);
