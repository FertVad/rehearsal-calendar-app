/**
 * A project's dot (T-036): one rule, from the project's id, in colours that
 * mean nothing else on the screen and can be seen on the rows' ground.
 */
import fs from 'fs';
import path from 'path';
import { PROJECT_PALETTE, projectColor } from '../projectColor';
import { Colors } from '../../constants/colors';

const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance and contrast. */
const luminance = (hex: string): number => {
  const [r, g, b] = rgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** CIELAB (D65), for how far apart two colours look. */
const lab = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex).map(linear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
/** CIE76 ΔE: about 2.3 is the least a person notices, above 20 two colours have different names. */
const distance = (a: string, b: string): number => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

// What already means something (T-031): purple doing and choosing, green
// free, red busy, yellow the phone's calendar — and the blue that went.
const TAKEN: Record<string, string> = {
  purple: Colors.accent.purple,
  purpleFill: Colors.accent.purpleFill,
  green: Colors.accent.green,
  red: Colors.accent.red,
  yellow: Colors.accent.yellow,
  blue: '#3b82f6',
};

describe('the palette', () => {
  it('has six to eight colours', () => {
    expect(PROJECT_PALETTE.length).toBeGreaterThanOrEqual(6);
    expect(PROJECT_PALETTE.length).toBeLessThanOrEqual(8);
  });

  it.each([...PROJECT_PALETTE])('%s is at least 3:1 on the rows’ ground', (colour) => {
    expect(contrast(colour, Colors.bg.secondary)).toBeGreaterThanOrEqual(3);
  });

  it.each([...PROJECT_PALETTE])('%s is none of the colours that mean something', (colour) => {
    const near = Object.entries(TAKEN)
      .map(([name, taken]) => ({ name, delta: Math.round(distance(colour, taken)) }))
      .filter(({ delta }) => delta < 25);
    expect(near).toEqual([]);
  });

  it('tells its own colours apart', () => {
    const near: string[] = [];
    PROJECT_PALETTE.forEach((a, i) => PROJECT_PALETTE.slice(i + 1).forEach((b) => {
      const delta = distance(a, b);
      if (delta < 25) near.push(`${a} ${b} ${delta.toFixed(1)}`);
    }));
    expect(near).toEqual([]);
  });
});

describe('projectColor', () => {
  it('is the same colour for the same project, every time', () => {
    expect(projectColor('42')).toBe(projectColor('42'));
    expect(projectColor(42)).toBe(projectColor('42'));
  });

  it('is always one of the palette', () => {
    for (let id = 0; id < 500; id += 1) {
      expect(PROJECT_PALETTE).toContain(projectColor(String(id)));
    }
    expect(PROJECT_PALETTE).toContain(projectColor(undefined));
  });

  it('gives projects made one after another different colours', () => {
    const ids = PROJECT_PALETTE.map((_, i) => String(i + 1));
    expect(new Set(ids.map(projectColor)).size).toBe(PROJECT_PALETTE.length);
  });

  it('spreads many projects over the whole palette', () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => projectColor(String(i + 1))));
    expect(used.size).toBe(PROJECT_PALETTE.length);
  });
});

// One place for the rule: no screen picks a project's colour on its own.
it('only projectColor.ts holds the palette', () => {
  const src = path.join(__dirname, '..', '..', '..');
  const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : files(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
  const holders = files(src).filter((file) =>
    PROJECT_PALETTE.some((colour) => fs.readFileSync(file, 'utf8').toUpperCase().includes(colour.toUpperCase())));
  expect(holders.map((file) => path.relative(src, file))).toEqual([path.join('shared', 'utils', 'projectColor.ts')]);
});
