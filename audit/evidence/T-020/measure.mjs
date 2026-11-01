// Where things stand down a screenshot, in points (T-020).
//
//   node measure.mjs <screenshot.png> [x-in-pt]
//
// Reads one column of pixels (24 pt in by default: inside a day's card, left
// of anything in it) and prints each run of one colour from top to bottom,
// in points: the screen is 852 pt tall, whatever the PNG's pixels. The top of
// the first day's card is where the card's border begins below
// "Recommendations".
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const [file, xArg] = process.argv.slice(2);
const SCREEN_PT = 852;
const png = readFileSync(file);

let pos = 8;
let width = 0;
let height = 0;
let channels = 0;
const idat = [];
while (pos < png.length) {
  const len = png.readUInt32BE(pos);
  const type = png.toString('ascii', pos + 4, pos + 8);
  const data = png.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    if (data[8] !== 8 || data[12] !== 0) throw new Error('8-bit, non-interlaced PNGs only');
    channels = { 2: 3, 6: 4 }[data[9]];
    if (!channels) throw new Error(`colour type ${data[9]} not handled`);
  } else if (type === 'IDAT') {
    idat.push(data);
  }
  pos += 12 + len;
}

const raw = inflateSync(Buffer.concat(idat));
const stride = width * channels;
const pixels = Buffer.alloc(height * stride);
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  for (let i = 0; i < stride; i++) {
    const a = i >= channels ? pixels[y * stride + i - channels] : 0;
    const b = y > 0 ? pixels[(y - 1) * stride + i] : 0;
    const c = y > 0 && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0;
    let v = line[i];
    if (filter === 1) v += a;
    else if (filter === 2) v += b;
    else if (filter === 3) v += (a + b) >> 1;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    pixels[y * stride + i] = v & 0xff;
  }
}

const scale = height / SCREEN_PT;
const x = Math.round(Number(xArg ?? 24) * scale);
const rgb = (y) => [0, 1, 2].map(k => pixels[y * stride + x * channels + k]);
const hex = (c) => c.map(v => v.toString(16).padStart(2, '0')).join('');

console.log(`${file}\n${width}×${height} px, ${scale.toFixed(3)} px a point, column x=${(x / scale).toFixed(1)} pt`);
let start = 0;
for (let y = 1; y <= height; y++) {
  if (y === height || hex(rgb(y)) !== hex(rgb(start))) {
    console.log(`y ${(start / scale).toFixed(1).padStart(6)} – ${(y / scale).toFixed(1).padStart(6)} pt  #${hex(rgb(start))}`);
    start = y;
  }
}
