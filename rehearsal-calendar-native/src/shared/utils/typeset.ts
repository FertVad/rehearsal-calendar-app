import type { Language } from '../../i18n/translations';

/**
 * Where iOS wraps a text itself — a larger text size in the phone's settings,
 * a note under a button, a row of a list — a line may not end on a short word
 * that belongs to the next one, nor begin with a dash, "→" or "…" (T-412). The
 * rule is each language's own, as its native speaker gave it, and lives here
 * only: a no-break space (U+00A0) glues the word to its neighbour. Only plain
 * spaces are touched; the line breaks a text was written with stay.
 *
 * - ru: no break after в, к, о, с, у, во, ко, об, со, до, за, из, на, от, по,
 *   а, и, да, но, то, не, ни, ну, уж, аж (any case); none before ли, же, ж,
 *   бы, б.
 * - en: none after "a", "A", "I".
 * - es: none after a, y, e, o, u (and their capitals).
 * - de: short words may end a line (Duden, DIN 5008); none between a number
 *   and its word, nor inside "z. B.".
 * - Every language: none before "—", "→", "…"; German before "–" too.
 */
const NBSP = ' ';

// Not a letter or a digit before the word: its start, a space, a quote, a bracket.
const START = '(?<![\\p{L}\\p{N}’\'])';
// Not a letter or a digit after it.
const END = '(?![\\p{L}\\p{N}])';

const after = (words: string[], flags: string) =>
  new RegExp(`${START}(${words.join('|')}) `, `g${flags}u`);

const RULES: Record<Language, { after: RegExp; before: RegExp; more?: Array<[RegExp, string]> }> = {
  ru: {
    after: after(
      ['в', 'к', 'о', 'с', 'у', 'во', 'ко', 'об', 'со', 'до', 'за', 'из', 'на', 'от', 'по',
        'а', 'и', 'да', 'но', 'то', 'не', 'ни', 'ну', 'уж', 'аж'],
      'i',
    ),
    before: / (?=[—→…])/g,
    more: [[new RegExp(` (?=(?:ли|же|ж|бы|б)${END})`, 'gu'), NBSP]],
  },
  en: { after: after(['a', 'A', 'I'], ''), before: / (?=[—→…])/g },
  es: { after: after(['a', 'y', 'e', 'o', 'u', 'A', 'Y', 'E', 'O', 'U'], ''), before: / (?=[—→…])/g },
  de: {
    // Nothing is glued after a word in German.
    after: /(?!)/g,
    before: / (?=[–—→…])/g,
    more: [
      // "1 Probe", "19:00 Uhr".
      [/(?<=\p{N}) (?=\p{L})/gu, NBSP],
      // "z. B.", "d. h.", "u. a.".
      [new RegExp(`(?<=${START}\\p{L}\\.) (?=\\p{L}\\.)`, 'gu'), NBSP],
    ],
  },
};

export function typeset(text: string, language: Language): string {
  const rule = RULES[language];
  let out = text.replace(rule.after, `$1${NBSP}`).replace(rule.before, NBSP);
  for (const [pattern, glue] of rule.more ?? []) out = out.replace(pattern, glue);
  return out;
}
