/**
 * How large an icon is drawn, read off a screenshot (T-023).
 *
 * A button that is only an icon is one accessibility element, 44 a side
 * whatever its icon: Maestro sees the target, never the glyph in it (flow 49
 * measures the targets). So the glyph is measured where it is drawn — the box
 * of the pixels in its colour, inside a part of the screen — in points.
 *
 * The screenshots are the simulator's, an 8-bit RGB or RGBA PNG; decoded here
 * with node:zlib rather than a package the app does not depend on.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

/** The pixels of a PNG: { width, height, channels, data } (8-bit, not interlaced). */
export function readPng(file) {
  const bytes = fs.readFileSync(file);
  let width = 0, height = 0, channels = 0;
  const idat = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('ascii', at + 4, at + 8);
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = body.subarray(8, 13);
      channels = { 2: 3, 6: 4 }[colour];
      if (depth !== 8 || !channels || interlace) throw new Error(`${file}: not an 8-bit RGB(A) PNG`);
    }
    if (type === 'IDAT') idat.push(body);
    at += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[y * stride + x - channels] : 0;
      const b = y > 0 ? data[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? data[(y - 1) * stride + x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      data[y * stride + x] = value & 0xff;
    }
  }
  return { width, height, channels, data };
}

/**
 * The box, in points, of the pixels within `tolerance` of `colour` ('#rrggbb')
 * inside `region` — fractions of the screen, { left, right, top, bottom }.
 * `scale`: pixels a point, 3 on the iPhone 16 the flows run on.
 */
export function inkBox(file, { colour, region, tolerance = 40, scale = 3 }) {
  const { width, height, channels, data } = readPng(file);
  const want = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = Math.floor(region.top * height); y < Math.ceil(region.bottom * height); y++) {
    for (let x = Math.floor(region.left * width); x < Math.ceil(region.right * width); x++) {
      const at = (y * width + x) * channels;
      if (want.every((v, i) => Math.abs(data[at + i] - v) <= tolerance)) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return null;
  return { width: (x1 - x0 + 1) / scale, height: (y1 - y0 + 1) / scale };
}
