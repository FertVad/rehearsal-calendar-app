/**
 * Every navigation in the app is checked by the compiler (review R9-03).
 *
 * "Create project" in the rehearsal form asked the Projects tab for a screen
 * it does not have, and the tap did nothing. The type check would have refused
 * the route, but the call was hidden from it — `useNavigation<any>()` there,
 * a `@ts-ignore` above it in two more places. With the nesting written down in
 * navigation/types.ts there is no route that needs either, so this keeps them
 * out: a wrong route has to be a compile error, never a dead button.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const UNCHECKED: { what: string; pattern: RegExp }[] = [
  { what: 'a navigation hook with no param list', pattern: /useNavigation(<any>)?\(\)|useRoute(<any>)?\(\)/ },
  { what: 'navigation typed as any', pattern: /navigation\??:\s*any\b|\(navigation as any\)|React\.useRef<any>|linking:\s*any\b/ },
  { what: 'a route name cast to any', pattern: /\.(navigate|push|replace)\(\s*'[^']*'\s+as any/ },
  { what: 'a screen registered as any', pattern: /component=\{\w+ as any\}/ },
];

function findings(): string[] {
  const out: string[] = [];
  for (const file of sources(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const where = `${relative(SRC, file)}:${i + 1}`;
      for (const { what, pattern } of UNCHECKED) {
        if (pattern.test(line)) out.push(`${where} — ${what}`);
      }
      // A suppression directly above a navigation call hides its route.
      if (/@ts-(ignore|expect-error)/.test(line) && /navigat/i.test(lines[i + 1] ?? '')) {
        out.push(`${where} — a type check switched off above a navigation`);
      }
    });
  }
  return out;
}

it('no navigation in the app is hidden from the type check', () => {
  expect(findings()).toEqual([]);
});
