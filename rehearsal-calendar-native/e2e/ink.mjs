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

/**
 * Where text is cut on a screenshot, inside `region` (fractions of the screen):
 * the "…" iOS draws in place of what does not fit (T-241). Maestro cannot see
 * it, for it reads a label whole however much of it is drawn.
 *
 * The ellipsis is found as it is drawn, whatever the colours: three dots of one
 * size, evenly spaced on one line, standing on the baseline of the letter
 * before them — "Se…", "Partici…os". A full stop is one dot, an "i"'s or an
 * umlaut's dots stand above the letters, the "·" between words is one and at
 * mid-height. A pixel is ink where it differs from what is around it 3 pt
 * away, so text on a card or a tinted segment counts as on the screen.
 *
 * Returns [{ left, top }] in points, one for each "…", empty when none.
 */
export function ellipses(file, { region, scale = 3 }) {
  const { width, height, channels, data } = readPng(file);
  const x0 = Math.max(0, Math.floor(region.left * width)), x1 = Math.min(width, Math.ceil(region.right * width));
  const y0 = Math.max(0, Math.floor(region.top * height)), y1 = Math.min(height, Math.ceil(region.bottom * height));
  const w = x1 - x0, h = y1 - y0;
  const far = scale * 3;
  const diff = (a, b) => Math.max(Math.abs(data[a] - data[b]), Math.abs(data[a + 1] - data[b + 1]), Math.abs(data[a + 2] - data[b + 2]));
  const at = (x, y) => (Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * channels;
  const around = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

  const samples = new Array(8);
  const ink = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const here = at(x, y);
      for (let i = 0; i < 8; i++) samples[i] = at(x + around[i][0] * far, y + around[i][1] * far);
      // Like most of what is around it: not ink (most of the screen, at once).
      let like = 0;
      for (let i = 0; i < 8; i++) if (diff(here, samples[i]) <= 50) like++;
      if (like >= 5) continue;
      // What is around: the sample most of the others agree with.
      let background = samples[0], most = -1;
      for (let i = 0; i < 8; i++) {
        let agree = 0;
        for (let j = 0; j < 8; j++) if (diff(samples[i], samples[j]) <= 24) agree++;
        if (agree > most) { most = agree; background = samples[i]; }
      }
      if (diff(here, background) > 50) ink[(y - y0) * w + (x - x0)] = 1;
    }
  }

  // The marks: ink connected to ink, each with its box and its pixels.
  const label = new Int32Array(w * h).fill(-1);
  const marks = [];
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (!ink[start] || label[start] >= 0) continue;
    const mark = { left: Infinity, top: Infinity, right: -1, bottom: -1, pixels: 0 };
    label[start] = marks.length;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop();
      const px = p % w, py = (p - px) / w;
      mark.left = Math.min(mark.left, px); mark.right = Math.max(mark.right, px);
      mark.top = Math.min(mark.top, py); mark.bottom = Math.max(mark.bottom, py);
      mark.pixels++;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (ink[n] && label[n] < 0) { label[n] = marks.length; stack.push(n); }
        }
      }
    }
    mark.width = mark.right - mark.left + 1;
    mark.height = mark.bottom - mark.top + 1;
    marks.push(mark);
  }

  // A dot: round, filled, of a text's size (1 to 4.5 pt).
  const isDot = (m) => m.width >= scale && m.width <= scale * 4.5 && m.height >= scale && m.height <= scale * 4.5
    && Math.abs(m.width - m.height) <= scale && m.pixels >= 0.5 * m.width * m.height;
  const dots = marks.filter(isDot).sort((a, b) => a.left - b.left);
  const alike = (a, b) => Math.abs(a.width - b.width) <= 2 && Math.abs(a.height - b.height) <= 2
    && Math.abs((a.top + a.bottom) - (b.top + b.bottom)) <= 3;
  const found = [];
  for (const a of dots) {
    const next = (from) => dots.find((d) => d !== from && alike(a, d) && d.left > from.right
      && d.left - from.left >= a.width + 1 && d.left - from.left <= a.width * 3.5);
    const b = next(a);
    const c = b && next(b);
    if (!c || Math.abs((b.left - a.left) - (c.left - b.left)) > 2) continue;
    // On the baseline of the letters before: a mark much taller than a dot,
    // its foot level with the dots', a few letters to their left at most
    // (an opening quote may stand between: «Video musical “…»).
    const letter = marks.some((m) => m.height >= a.height * 2.5 && m.right < a.left
      && a.left - m.right <= a.width * 8 && Math.abs(m.bottom - a.bottom) <= scale);
    if (!letter) continue;
    if (found.some((f) => f.a === a || f.b === a || f.c === a)) continue;
    found.push({ a, b, c });
  }
  return found.map(({ a }) => ({ left: Math.round((a.left + x0) / scale), top: Math.round((a.top + y0) / scale) }));
}
