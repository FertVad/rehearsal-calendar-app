/**
 * No sheet in the app is wrapped in the touchable that closes it.
 *
 * Six were: a TouchableOpacity or Pressable straight inside the Modal, with the
 * sheet as its child. iOS then presents the whole sheet as one button —
 * VoiceOver could not reach a project in the rehearsal form's picker, a member
 * action, a picker's Done, and neither could the e2e flows — and a tap on the
 * sheet's title closed it. ModalSheet puts the closing area behind the sheet;
 * this keeps the wrapping form out.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..', '..');
const TOUCHABLES = new Set(['TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'Pressable']);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

/** The first element inside each `<Modal …>` of a file, with its line. */
function firstChildren(text: string): { tag: string; line: number }[] {
  const found: { tag: string; line: number }[] = [];
  for (const match of text.matchAll(/<Modal\b/g)) {
    // Walk to the end of the opening tag; its props hold arrows and braces.
    let depth = 0;
    let i = match.index! + match[0].length;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const child = /<([A-Za-z][\w.]*)/.exec(text.slice(i + 1));
    if (child) found.push({ tag: child[1], line: text.slice(0, i + 1 + child.index).split('\n').length });
  }
  return found;
}

it('no Modal opens on a touchable wrapped around its sheet', () => {
  const wrapped = sources(SRC).flatMap((file) =>
    firstChildren(readFileSync(file, 'utf8'))
      .filter(({ tag }) => TOUCHABLES.has(tag))
      .map(({ tag, line }) => `${relative(SRC, file)}:${line} — <${tag}> around the sheet; use ModalSheet`));
  expect(wrapped).toEqual([]);
});
