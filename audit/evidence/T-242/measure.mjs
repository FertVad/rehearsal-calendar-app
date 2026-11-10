#!/usr/bin/env node
// T-242: what an `expo export --platform ios --source-maps` holds.
//   node ../audit/evidence/T-242/measure.mjs <export dir> [report file]
// (from rehearsal-calendar-native; the report goes to stdout and the file)
// Fonts among the assets, the .hbc's size, the bundle's source size, whether
// the source map names the modules the task removes, and whether the .hbc
// holds the link prefixes it removes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [dir, reportFile] = process.argv.slice(2);
if (!dir) { console.error('usage: measure.mjs <export dir> [report file]'); process.exit(64); }

const lines = [];
const say = (line) => { lines.push(line); console.log(line); };

const meta = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
const assets = meta.fileMetadata.ios.assets;
const fonts = assets.filter((a) => a.ext === 'ttf');
const assetBytes = (a) => fs.statSync(path.join(dir, a.path)).size;
const fontBytes = fonts.reduce((sum, a) => sum + assetBytes(a), 0);

const bundle = meta.fileMetadata.ios.bundle;
const hbcBytes = fs.readFileSync(path.join(dir, bundle));
const map = JSON.parse(fs.readFileSync(path.join(dir, `${bundle}.map`), 'utf8'));
const sources = map.sources;
const sourceBytes = (map.sourcesContent ?? []).reduce((sum, s) => sum + Buffer.byteLength(s ?? ''), 0);

const NEEDLES = [
  'lodash/lodash.js',
  'node_modules/moment/',
  'node_modules/recyclerlistview/',
  'react-native-calendars/src/agenda/',
  'react-native-calendars/src/expandableCalendar/',
  'react-native-calendars/src/timeline/',
  'react-native-calendars/src/timeline-list/',
  'react-native-calendars/src/calendar-list/',
  'react-native-calendars/src/infinite-list/',
  'react-native-calendars/src/index.ts',
  '@expo/vector-icons/build/IconsLazy.js',
];
const STRINGS = ['server-fertvads-projects.vercel.app', 'http://localhost:3001', 'http://10.0.2.2:3001', 'https://rehearsly.me'];
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

say(`export: ${dir}`);
say(`bundle: ${bundle} — ${hbcBytes.length} bytes (${(hbcBytes.length / 1e6).toFixed(2)} MB)`);
say(`modules in the source map: ${sources.length}; source text: ${(sourceBytes / 1e6).toFixed(2)} MB`);
say(`fonts (${fonts.length}, ${(fontBytes / 1e6).toFixed(2)} MB):`);
// The export names an asset by its hash; the font's own name is that of the
// file in node_modules with the same md5 (run from rehearsal-calendar-native).
const FONT_DIR = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts';
const byHash = new Map(fs.readdirSync(FONT_DIR).map((name) => [
  crypto.createHash('md5').update(fs.readFileSync(path.join(FONT_DIR, name))).digest('hex'), name,
]));
for (const f of fonts) {
  const hash = f.path.split('/').pop();
  say(`  ${byHash.get(hash) ?? `${hash}.ttf`}  ${kb(assetBytes(f))}`);
}
say('modules named in the source map:');
for (const needle of NEEDLES) {
  const hits = sources.filter((s) => s.includes(needle));
  say(`  ${hits.length ? 'YES' : 'no '}  ${needle}${hits.length ? `  (${hits.length} files)` : ''}`);
}
say('strings in the .hbc:');
for (const s of STRINGS) say(`  ${hbcBytes.includes(Buffer.from(s)) ? 'YES' : 'no '}  ${s}`);
const icons = sources.filter((s) => s.includes('@expo/vector-icons/')).map((s) => s.split('@expo/vector-icons/')[1]);
say(`@expo/vector-icons files (${icons.length}): ${icons.sort().join(', ')}`);
const calendars = sources.filter((s) => s.includes('react-native-calendars/src/')).map((s) => s.split('react-native-calendars/src/')[1]);
say(`react-native-calendars files (${calendars.length}): ${calendars.sort().join(', ')}`);

if (reportFile) fs.writeFileSync(reportFile, `${lines.join('\n')}\n`);
