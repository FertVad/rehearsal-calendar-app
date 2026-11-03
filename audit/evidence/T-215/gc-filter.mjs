// T-215: read a Jest run made with node --trace-gc on stdin; print each file's
// result line and every garbage-collection pause of at least <ms> (default 300)
// between them, so a long pause can be matched to the file it fell in.
//
//   node --trace-gc --experimental-vm-modules node_modules/jest/bin/jest.js ... 2>&1 \
//     | node ../audit/evidence/T-215/gc-filter.mjs 300
import { createInterface } from 'node:readline';

const min = Number(process.argv[2] ?? 300);
let pauses = 0;
let total = 0;
for await (const line of createInterface({ input: process.stdin })) {
  // [pid:addr]  12345 ms: Mark-Compact 1500.1 (1600.2) -> 1400.3 (1580.0) MB, pooled: 0 MB, 2345.67 / 0.00 ms ...
  const gc = line.match(/(\d+) ms: (Mark-Compact|Scavenge|Mark-Compact \(reduce\)|Minor Mark-Sweep)[^,]*?([\d.]+) \([\d.]+\) -> ([\d.]+).*?MB, .*?([\d.]+) \/ [\d.]+ ms/);
  if (gc) {
    const pause = Number(gc[5]);
    total += pause;
    if (pause >= min) {
      pauses += 1;
      console.log(`  GC at ${gc[1]} ms: ${gc[2]} ${gc[3]} -> ${gc[4]} MB, pause ${pause} ms`);
    }
    continue;
  }
  if (/^(PASS|FAIL) |Exceeded timeout|^Tests:|^Time:|says whether/.test(line.trim())) console.log(line.trim());
}
console.log(`=== ${pauses} pauses of ${min} ms or more; all pauses together ${(total / 1000).toFixed(1)} s`);
