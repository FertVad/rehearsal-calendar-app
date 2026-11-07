/**
 * One colour for doing and choosing: purple (T-031, owner 04.11).
 *
 * Blue stood beside it and meant nothing of its own — "Today" in the day
 * strip, a project's name and folder, the eye of a rehearsal seen, settings
 * icons — while buttons and the day picked were purple. Apple: "Avoid using
 * the same color to mean different things." So blue is gone from the palette,
 * which keeps `Colors.accent.blue` from coming back, and no source names it
 * as a literal either.
 *
 * Avatars keep theirs: a colour per person is who it is, not what it means
 * (UserAvatar.tsx).
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Colors } from '../colors';

const SRC = join(__dirname, '..', '..', '..');
const AVATARS = join(SRC, 'shared', 'components', 'UserAvatar.tsx');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

// #3b82f6 in any case, its rgb()/rgba() form with any spacing, and the key.
const BLUE = /#3b82f6\b|rgba?\(\s*59\s*,\s*130\s*,\s*246\b|accent\.blue\b|accent\[['"]blue['"]\]/i;

it('the palette has no blue', () => {
  expect(Object.keys(Colors.accent)).not.toContain('blue');
});

it('no source paints blue, but for the avatars', () => {
  const blue = sources(SRC)
    .filter((file) => file !== AVATARS)
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((text, i) => ({ text, line: i + 1 }))
        .filter(({ text }) => BLUE.test(text))
        .map(({ line, text }) => `${relative(SRC, file)}:${line}: ${text.trim()}`));
  expect(blue).toEqual([]);
});
