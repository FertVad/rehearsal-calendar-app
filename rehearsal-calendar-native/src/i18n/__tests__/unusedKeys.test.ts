/**
 * Every string in the interface is shown somewhere (T-045). A key nobody reads
 * still has to be written in four languages and kept in step with the screens,
 * and it reads as a feature that is no longer there.
 *
 * A key is read when its path t.a.b appears in the app's code (tests do not
 * count: a key only a test reads is not on any screen). The code also reads
 * through a name it gave part of the tree — `const w = t.onboarding.whatWhere`,
 * then `w.title` — and that counts the same. A few keys are picked by a value
 * at run time, t.profile[option.labelKey]; they are listed below with the code
 * that picks them, and the test checks that code is still there.
 */
import * as fs from 'fs';
import * as path from 'path';
import { translations } from '../translations';

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const TRANSLATIONS = path.join(SRC, 'i18n', 'translations');

/** Keys read by a computed name, with where and how. */
const DYNAMIC: Array<{ keys: string[]; file: string; reads: string; why: string }> = [
  {
    keys: ['availability.free', 'availability.busy', 'availability.partial'],
    file: 'src/features/availability/components/calendar/CalendarMonth.tsx',
    reads: 't.availability[status]',
    why: "the day's status names its label; 'none' has no label",
  },
  {
    keys: ['profile.weekStartMonday', 'profile.weekStartSunday'],
    file: 'src/features/profile/screens/ProfileScreen.tsx',
    reads: 't.profile[option.labelKey]',
    why: 'each week-start option carries the key of its label',
  },
];

function codeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || full === TRANSLATIONS) return [];
      return codeFiles(full);
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return [];
    return [full];
  });
}

/** Leaf paths of the tree: strings and functions. */
function leaves(node: unknown, prefix: string): string[] {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

/** Every t.a.b path the code mentions, aliases resolved: `const w = t.x.y; w.z` is t.x.y.z. */
function pathsInCode(): Set<string> {
  const found = new Set<string>();
  const files = [...codeFiles(SRC), path.join(ROOT, 'App.tsx')];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const roots = new Map<string, string>([['t', '']]);
    for (const alias of text.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*t((?:\.[A-Za-z_$][\w$]*)+)\s*;/g)) {
      roots.set(alias[1], alias[2].slice(1));
    }
    for (const [name, base] of roots) {
      const access = new RegExp(`(?<![\\w$.])${name.replace('$', '\\$')}((?:\\??\\.[A-Za-z_$][\\w$]*)+)`, 'g');
      for (const match of text.matchAll(access)) {
        const tail = match[1].replace(/\?/g, '').slice(1);
        found.add(base ? `${base}.${tail}` : tail);
      }
    }
  }
  return found;
}

describe('translation keys', () => {
  const keys = leaves(translations.en, '');
  const mentioned = pathsInCode();
  const dynamic = new Set(DYNAMIC.flatMap((entry) => entry.keys));

  it('every key of the interface is read by the app', () => {
    const unused = keys.filter((key) => {
      if (mentioned.has(key)) return false;
      // A whole subtree taken by name, like t.days.short for the list of days.
      return ![...dynamic].some((d) => key === d || key.startsWith(`${d}.`));
    });
    expect(unused).toEqual([]);
  });

  it.each(DYNAMIC.map((entry) => [entry.reads, entry]))('%s still picks its keys', (_reads, entry) => {
    const text = fs.readFileSync(path.join(ROOT, entry.file), 'utf8');
    expect(text).toContain(entry.reads);
    for (const key of entry.keys) {
      expect(keys.some((k) => k === key || k.startsWith(`${key}.`))).toBe(true);
    }
  });

  it('the four languages have the same keys', () => {
    for (const language of ['ru', 'es', 'de'] as const) {
      expect(leaves(translations[language], '').sort()).toEqual([...keys].sort());
    }
  });
});
