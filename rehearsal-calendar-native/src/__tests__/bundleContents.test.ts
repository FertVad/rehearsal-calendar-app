/**
 * The app carries only what it uses (T-242).
 *
 * Metro drops nothing a module requires. `@expo/vector-icons`' own entry file
 * requires every icon set, so one `import { Ionicons } from '@expo/vector-icons'`
 * put all 19 fonts (3.9 MB) and every set's glyph map in the app, which draws
 * Ionicons alone. `react-native-calendars`' entry file requires Agenda,
 * CalendarList, ExpandableCalendar, Timeline and the rest, and with them the
 * whole of lodash, moment and recyclerlistview — about 1.2 MB of the bundle's
 * 7.7 MB of source, for a month grid. Both are imported by the path of the one
 * part used.
 *
 * linking.ts listed the project's old vercel.app address and the dev server's
 * localhost as link prefixes. Neither opens the app — universal links come from
 * rehearsly.me only (app.json associatedDomains), the dev server hands out
 * rehearsalapp:// links — and the vercel.app address showed in the bundle.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

jest.mock('expo-linking', () => ({ createURL: () => 'rehearsalapp://' }));

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return /\.(ts|tsx|js|jsx)$/.test(name) && !/\.(test|spec)\./.test(name) ? [full] : [];
  });
}

const ENTRY_FILES: { what: string; pattern: RegExp }[] = [
  {
    what: "@expo/vector-icons' entry file, which requires all 19 icon fonts",
    pattern: /(from\s+|require\(\s*|import\(\s*)['"]@expo\/vector-icons['"]/,
  },
  {
    what: "react-native-calendars' entry file, which requires Agenda, Timeline, lodash, moment",
    pattern: /(from\s+|require\(\s*|import\(\s*)['"]react-native-calendars['"]/,
  },
];

it('no app file imports a library entry file that pulls in what the app does not use', () => {
  const found: string[] = [];
  for (const file of sources(SRC)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const { what, pattern } of ENTRY_FILES) {
        if (pattern.test(line)) found.push(`${relative(SRC, file)}:${i + 1} — ${what}`);
      }
    });
  }
  expect(found).toEqual([]);
});

it('the link prefixes are the ones that open the app, with no dead or local address', () => {
  const source = readFileSync(join(SRC, 'navigation', 'linking.ts'), 'utf8');
  const dead = source.split('\n')
    .map((line, i) => ({ line, at: i + 1 }))
    .filter(({ line }) => /vercel\.app|localhost|10\.0\.2\.2/.test(line))
    .map(({ line, at }) => `linking.ts:${at} — ${line.trim()}`);
  expect(dead).toEqual([]);
});

it('the link prefixes are the app scheme and rehearsly.me', () => {
  // The module itself, as the app sees it.
  const { linking } = require('../navigation/linking');
  expect(linking.prefixes.filter((p: string) => /^https?:/.test(p))).toEqual(['https://rehearsly.me']);
  expect(linking.prefixes).toContain('rehearsalapp://');
});
