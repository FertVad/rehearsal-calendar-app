// Copies flow 74's screenshots and recording from a Maestro artifacts folder
// into this evidence folder, each name suffixed (before / after).
// node audit/evidence/T-035/collect.mjs <artifacts/<run>/<flow name>> <suffix>
import fs from 'node:fs';
import path from 'node:path';

const [source, suffix] = process.argv.slice(2);
if (!source || !suffix) throw new Error('usage: collect.mjs <flow artifacts dir> <suffix>');
const here = path.dirname(new URL(import.meta.url).pathname);
for (const sub of ['takeScreenshot', 'startRecording', 'screenshots']) {
  const dir = path.join(source, sub);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    const { name: base, ext } = path.parse(name);
    const to = path.join(here, `${base}-${suffix}${ext}`);
    fs.copyFileSync(path.join(dir, name), to);
    console.log(to);
  }
}
