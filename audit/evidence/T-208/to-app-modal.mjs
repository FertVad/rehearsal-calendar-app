// T-208: turns each <Modal visible transparent animationType onRequestClose> of
// the given files into <AppModal …> — the same props less `transparent`, which
// every one of them had. Imports are changed by hand.
import { readFileSync, writeFileSync } from 'node:fs';

for (const file of process.argv.slice(2)) {
  const before = readFileSync(file, 'utf8');
  const opened = (before.match(/<Modal\b/g) || []).length;
  const after = before
    .replace(/<Modal\b([^>]*?)\n[ \t]*transparent(=\{true\})?\n/g, (_, head) => `<AppModal${head}\n`)
    .replace(/<\/Modal>/g, '</AppModal>');
  const left = (after.match(/<Modal\b/g) || []).length;
  if (left) throw new Error(`${file}: ${left} of ${opened} Modal tags not turned`);
  writeFileSync(file, after);
  console.log(`${file}: ${opened} turned`);
}
