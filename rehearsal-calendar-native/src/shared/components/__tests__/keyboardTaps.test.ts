/**
 * With the keyboard up, a tap on a form's button presses it.
 *
 * A ScrollView spends the first tap on hiding the keyboard unless told
 * otherwise, so "Create" on the new-project form did nothing for someone who
 * had just typed the name — found by the e2e flow. Every screen with a text
 * input sets keyboardShouldPersistTaps on its scroll views.
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

/** Each `<ScrollView …>` opening tag of a file, with its line. */
function scrollViews(text: string): { tag: string; line: number }[] {
  return [...text.matchAll(/<ScrollView\b/g)].map((match) => {
    let depth = 0;
    let i = match.index! + match[0].length;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    return { tag: text.slice(match.index!, i + 1), line: text.slice(0, match.index).split('\n').length };
  });
}

it('every scroll view on a screen with a text input lets a tap through the keyboard', () => {
  const swallowing = sources(SRC)
    .filter((file) => readFileSync(file, 'utf8').includes('<TextInput'))
    .flatMap((file) => scrollViews(readFileSync(file, 'utf8'))
      .filter(({ tag }) => !tag.includes('keyboardShouldPersistTaps'))
      .map(({ line }) => `${relative(SRC, file)}:${line}`));
  expect(swallowing).toEqual([]);
});
