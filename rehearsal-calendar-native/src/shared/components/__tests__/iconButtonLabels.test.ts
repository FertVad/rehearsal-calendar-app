/**
 * A button that is only an icon says what it does.
 *
 * Twenty-one did not — back arrows, the close crosses on sheets, delete and
 * edit on rehearsal cards, the eye that marks a rehearsal seen, the "+" in the
 * tab bar. VoiceOver read nothing on them, and the e2e flows could reach them
 * only by where they happen to sit on screen. Any TouchableOpacity or
 * Pressable with an icon and no text carries an accessibilityLabel.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

/** Touchables of a file: the opening tag, what they contain, and the line. */
function touchables(text: string): { tag: string; body: string; line: number }[] {
  return [...text.matchAll(/<(TouchableOpacity|Pressable)\b/g)].flatMap((match) => {
    let depth = 0;
    let i = match.index! + match[0].length;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const tag = text.slice(match.index!, i + 1);
    if (tag.endsWith('/>')) return [];
    const body = text.slice(i + 1, text.indexOf(`</${match[1]}>`, i));
    return [{ tag, body, line: text.slice(0, match.index).split('\n').length }];
  });
}

it('every icon-only button has an accessibility label', () => {
  const silent = sources(SRC).flatMap((file) =>
    touchables(readFileSync(file, 'utf8'))
      .filter(({ tag, body }) => body.includes('<Ionicons') && !/<Text\b/.test(body) && !tag.includes('accessibilityLabel'))
      .map(({ line }) => `${relative(SRC, file)}:${line}`));
  expect(silent).toEqual([]);
});
