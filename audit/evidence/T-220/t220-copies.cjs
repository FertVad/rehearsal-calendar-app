// T-220 scratch: `node t220-copies.cjs make N` writes N copies of flow 30 as it is
// in the tree (the d670967 version, restored) into e2e/flows/t220-rep-<i>.yaml,
// only `name:` changed so Maestro runs each; `node t220-copies.cjs clean` removes them.
const fs = require('fs');
const path = require('path');
const flows = path.join(__dirname, '..', 'flows');
const [mode, count] = process.argv.slice(2);
for (const name of fs.readdirSync(flows)) {
  if (/^t220-rep-\d+\.yaml$/.test(name)) fs.unlinkSync(path.join(flows, name));
}
if (mode === 'make') {
  const source = fs.readFileSync(path.join(flows, '30-sync-import-fails-export-runs.yaml'), 'utf8');
  if (!source.includes('MS: "40000"')) throw new Error('flow 30 is not the d670967 version');
  for (let i = 1; i <= Number(count); i++) {
    const file = path.join(flows, `t220-rep-${i}.yaml`);
    fs.writeFileSync(file, source.replace('name: A sync whose import fails still exports', `name: A sync whose import fails still exports - rep ${i}`));
    console.log(path.relative(process.cwd(), file));
  }
}
