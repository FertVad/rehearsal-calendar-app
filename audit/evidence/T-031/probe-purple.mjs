// Where a colour is on a screenshot, by columns of points (T-031 review,
// tuning flow 71's regions): node probe-purple.mjs <png> <#rrggbb> <tol> <top> <bottom>
import { readPng } from '../../../rehearsal-calendar-native/e2e/ink.mjs';

const [file, colour, tol, top, bottom] = process.argv.slice(2);
const { width, height, channels, data } = readPng(file);
const want = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
const hits = new Map();
for (let y = Math.floor(Number(top) * height); y < Math.ceil(Number(bottom) * height); y++) {
  for (let x = 0; x < width; x++) {
    const at = (y * width + x) * channels;
    const px = [data[at], data[at + 1], data[at + 2]];
    if (want.every((v, i) => Math.abs(px[i] - v) <= Number(tol))) {
      const key = `${Math.floor(x / 3)},${Math.floor(y / 3)}`;
      if (!hits.has(key)) hits.set(key, px.map((v) => v.toString(16).padStart(2, '0')).join(''));
    }
  }
}
const xs = [...hits.keys()].map((k) => Number(k.split(',')[0]));
console.log('points', hits.size, 'x from', Math.min(...xs), 'to', Math.max(...xs));
const byX = {};
for (const [k, v] of hits) { const x = k.split(',')[0]; byX[x] = byX[x] || v; }
console.log(Object.entries(byX).map(([x, v]) => `${x}:#${v}`).join(' '));
