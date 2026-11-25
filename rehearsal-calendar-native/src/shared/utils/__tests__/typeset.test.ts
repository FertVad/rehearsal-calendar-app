/**
 * The typesetting of a text iOS wraps itself (T-412): a short word does not
 * end a line, and a dash, "→" or "…" does not begin one — each language by its
 * native speaker's rule (audit/evidence/T-412/natives.md, section 2).
 */
import { typeset } from '../typeset';

const N = ' ';

describe('typeset', () => {
  it('ru: the short words, any case, are glued to the next one', () => {
    expect(typeset('Репетиция уходит всем в календарь', 'ru')).toBe(`Репетиция уходит всем в${N}календарь`);
    expect(typeset('В одном месте и в другом', 'ru')).toBe(`В${N}одном месте и${N}в${N}другом`);
    expect(typeset('Не сейчас', 'ru')).toBe(`Не${N}сейчас`);
    for (const word of ['к', 'о', 'с', 'у', 'во', 'ко', 'об', 'со', 'до', 'за', 'из', 'на', 'от', 'по', 'а', 'да', 'но', 'то', 'ни', 'ну', 'уж', 'аж']) {
      expect(typeset(`слово ${word} слово`, 'ru')).toBe(`слово ${word}${N}слово`);
    }
  });

  it('ru: a short word at a word\'s end, or the word\'s start, is not one', () => {
    expect(typeset('Новая репетиция', 'ru')).toBe('Новая репетиция');
    expect(typeset('Команда видит только эти часы', 'ru')).toBe('Команда видит только эти часы');
  });

  it('ru: ли, же, бы are glued to the word before', () => {
    expect(typeset('отмечать ли выходные', 'ru')).toBe(`отмечать${N}ли выходные`);
    expect(typeset('тот же день', 'ru')).toBe(`тот${N}же день`);
    expect(typeset('если бы знал', 'ru')).toBe(`если${N}бы знал`);
    expect(typeset('если б знал', 'ru')).toBe(`если${N}б знал`);
    expect(typeset('лишь бытие', 'ru')).toBe('лишь бытие');
  });

  it('en: "a", "A" and "I" are glued to the next word', () => {
    expect(typeset('You Were Added to a Rehearsal', 'en')).toBe(`You Were Added to a${N}Rehearsal`);
    expect(typeset('A new rehearsal, I know', 'en')).toBe(`A${N}new rehearsal, I${N}know`);
    expect(typeset('an idea', 'en')).toBe('an idea');
    expect(typeset('you’re a star', 'en')).toBe(`you’re a${N}star`);
  });

  it('es: a, y, e, o, u, and their capitals, are glued to the next word', () => {
    expect(typeset('Ensayo nuevo, cancelado o reprogramado:', 'es')).toBe(`Ensayo nuevo, cancelado o${N}reprogramado:`);
    expect(typeset('y de él llegarán a Rehearsly', 'es')).toBe(`y${N}de él llegarán a${N}Rehearsly`);
    expect(typeset('siete u ocho e ideas', 'es')).toBe(`siete u${N}ocho e${N}ideas`);
    expect(typeset('Y luego', 'es')).toBe(`Y${N}luego`);
  });

  it('de: short words may end a line', () => {
    expect(typeset('Proben landen von selbst in deinem Kalender', 'de')).toBe('Proben landen von selbst in deinem Kalender');
    expect(typeset('du erfährst es sofort', 'de')).toBe('du erfährst es sofort');
  });

  it('de: a number with its word, and "z. B." whole', () => {
    expect(typeset('1 Probe um 19:00 Uhr', 'de')).toBe(`1${N}Probe um 19:00${N}Uhr`);
    expect(typeset('Proben, z. B. am Abend', 'de')).toBe(`Proben, z.${N}B. am Abend`);
  });

  it.each(['ru', 'en', 'es'] as const)('%s: no line begins with "—", "→" or "…"', (language) => {
    expect(typeset('Проект — Профиль → Синхронизация …', language))
      .toBe(`Проект${N}— Профиль${N}→ Синхронизация${N}…`);
  });

  it('de: nor with "–"', () => {
    expect(typeset('Neue Probe – du erfährst es', 'de')).toBe(`Neue Probe${N}– du erfährst es`);
    expect(typeset('Profil → Einstellungen, wird eingerichtet …', 'de')).toBe(`Profil${N}→ Einstellungen, wird eingerichtet${N}…`);
  });

  it('keeps the lines a text was written with, and the no-break spaces in it', () => {
    expect(typeset('Новая репетиция, отменили или перенесли —\nвы узнаете сразу.', 'ru'))
      .toBe(`Новая репетиция, отменили или перенесли${N}—\nвы узнаете сразу.`);
    expect(typeset(`busy hours from${N}it.`, 'en')).toBe(`busy hours from${N}it.`);
    expect(typeset('Planifica ensayos\ny sincroniza', 'es')).toBe(`Planifica ensayos\ny${N}sincroniza`);
  });

  it.each(['ru', 'en', 'es', 'de'] as const)('%s: a text with nothing to glue is returned as it is', (language) => {
    expect(typeset('Rehearsly', language)).toBe('Rehearsly');
    expect(typeset('Calendar Sync', language)).toBe('Calendar Sync');
    expect(typeset('', language)).toBe('');
  });
});
