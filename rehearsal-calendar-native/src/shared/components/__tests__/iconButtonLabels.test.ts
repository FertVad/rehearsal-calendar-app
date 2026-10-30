/**
 * A button that is only an icon says what it does.
 *
 * Twenty-one did not — back arrows, the close crosses on sheets, delete and
 * edit on rehearsal cards, the eye that marks a rehearsal seen, the "+" in the
 * tab bar. VoiceOver read nothing on them, and the e2e flows could reach them
 * only by where they happen to sit on screen. Any TouchableOpacity or
 * Pressable with an icon and no text carries an accessibilityLabel.
 *
 * And it is an IconButton (T-014). Each screen drew its own, from 24×24 to
 * 38×38 pt — under the 44×44 the HIG asks of a target. IconButton holds the
 * size and asks for the label; a touchable with an icon and no text anywhere
 * else is refused.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..', '..');
const ICON_BUTTON = join(SRC, 'shared', 'components', 'IconButton.tsx');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

/** Elements of a file by tag: the opening tag, what they contain, and the line. */
function elements(text: string, tags: RegExp): { tag: string; body: string; line: number }[] {
  return [...text.matchAll(tags)].flatMap((match) => {
    let depth = 0;
    let i = match.index! + match[0].length;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const tag = text.slice(match.index!, i + 1);
    const line = text.slice(0, match.index).split('\n').length;
    if (tag.endsWith('/>')) return [{ tag, body: '', line }];
    const body = text.slice(i + 1, text.indexOf(`</${match[1]}>`, i));
    return [{ tag, body, line }];
  });
}

const TOUCHABLES = /<(TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Pressable)\b/g;
const iconOnly = ({ body }: { body: string }) => body.includes('<Ionicons') && !/<Text\b/.test(body);

// IconButton's own touchable takes the label from its props, which require it.
const app = () => sources(SRC).filter((file) => file !== ICON_BUTTON);

it('every icon-only button has an accessibility label', () => {
  const silent = app().flatMap((file) =>
    elements(readFileSync(file, 'utf8'), TOUCHABLES)
      .filter((touchable) => iconOnly(touchable) && !touchable.tag.includes('accessibilityLabel'))
      .map(({ line }) => `${relative(SRC, file)}:${line}`));
  expect(silent).toEqual([]);
});

it('every icon-only button is an IconButton', () => {
  const ownMade = app()
    .flatMap((file) =>
      elements(readFileSync(file, 'utf8'), TOUCHABLES)
        .filter(iconOnly)
        .map(({ line }) => `${relative(SRC, file)}:${line}`));
  expect(ownMade).toEqual([]);
});

it('every IconButton says what it does', () => {
  const silent = sources(SRC).flatMap((file) =>
    elements(readFileSync(file, 'utf8'), /<(IconButton)\b/g)
      .filter(({ tag }) => !tag.includes('accessibilityLabel'))
      .map(({ line }) => `${relative(SRC, file)}:${line}`));
  expect(silent).toEqual([]);
});
