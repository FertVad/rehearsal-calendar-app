// T-418 (review 1): every Safari process in device-simulator.log(s) - when it
// started, the accessibility its WebContent processes were given ("app ax"),
// and whether CoreFoundation said at its start that its home directory was
// inaccessible ("Disabling saving preferences for { <domain> ... because home
// directory is inaccessible"), with the domains it named.
// node safari-starts.mjs <device-simulator.log>...
import fs from 'node:fs';

for (const file of process.argv.slice(2)) {
  const procs = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = / MobileSafari\[(\d+)\]: /.exec(line);
    if (!m) continue;
    let p = procs.get(m[1]);
    if (!p) {
      p = { from: line.slice(11, 23), ax: new Set(), homeless: new Set() };
      procs.set(m[1], p);
    }
    const ax = /\(app ax: (\d)\)/.exec(line);
    if (ax) p.ax.add(ax[1]);
    const home = /Disabling saving preferences for \{ ([^,]+),.*home directory is inaccessible/.exec(line);
    if (home) p.homeless.add(home[1]);
  }
  console.log(file);
  for (const [pid, p] of procs) {
    const homeless = p.homeless.size ? `home inaccessible: ${[...p.homeless].join(', ')}` : 'home readable';
    console.log(`  MobileSafari[${pid}] ${p.from}  app ax: ${[...p.ax].join('/') || '-'}  ${homeless}`);
  }
}
