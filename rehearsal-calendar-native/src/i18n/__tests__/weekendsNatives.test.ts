/**
 * The weekends' strings as the native speakers of ru, en, es and de wrote
 * them (T-408, after T-406), word for word, and what each edit was for:
 *
 * - П1: the switch's error said "could not change the weekends", read as "the
 *   days could not be moved"; it is the setting that was not saved.
 * - П2: the editor's hint on a weekend day says the day changes as any day
 *   does, and that the default is turned off for all weekends at once.
 * - П3: "Skip" names the weekends among what can be set later: whoever skips
 *   keeps them busy.
 *
 * And the path to the switch and the days in the question do not break inside
 * a line: no-break spaces inside the labels, around "→", and between the days
 * ("(пт / и сб)" was possible). No text has a line break of its own but the
 * onboarding's question and description, which T-412 sets in lines by their
 * sense, as the native speakers broke them.
 */
import { translations } from '../translations';
import { settingPath } from '../../shared/utils/settingPath';

type Lang = 'ru' | 'en' | 'es' | 'de';
const LANGS: Lang[] = ['ru', 'en', 'es', 'de'];
const NBSP = '\u00a0';

const PATH: Record<Lang, string> = {
  ru: `Профиль${NBSP}→${NBSP}Выходные${NBSP}заняты`,
  en: `Profile${NBSP}→${NBSP}Mark${NBSP}Weekends${NBSP}as${NBSP}Busy`,
  es: `Perfil${NBSP}→${NBSP}Fines${NBSP}de${NBSP}semana${NBSP}ocupados`,
  de: `Profil${NBSP}→${NBSP}Wochenenden${NBSP}belegt`,
};

const pathOf = (lang: Lang) => settingPath(translations[lang].nav.profile, translations[lang].profile.weekendsBusy);

const EXPECTED: Record<Lang, {
  weekendsBusy: string;
  weekendsBusyError: string;
  description: string;
  note: string;
  no: string;
  weekendDefault: string;
  skipMessage: string;
}> = {
  ru: {
    weekendsBusy: 'Выходные заняты',
    weekendsBusyError: 'Не удалось сохранить настройку выходных',
    description: 'Тогда при подборе времени\nваши выходные будут считаться занятыми.\nЛюбой выходной можно отметить иначе\nв «Занятости».',
    note: `Это можно включить${NBSP}или${NBSP}выключить позже: ${PATH.ru}`,
    no: 'Нет, оставить свободными',
    weekendDefault: `Выходной: занят по умолчанию. Его, как любой день, можно отметить иначе, а выключить это сразу для всех выходных: ${PATH.ru}.`,
    skipMessage: 'Начало недели, синхронизацию\u00a0календаря и\u00a0то, отмечать\u00a0ли выходные\u00a0занятыми, можно\u00a0настроить в\u00a0любое\u00a0время: Профиль\u00a0→\u00a0Настройки.',
  },
  en: {
    weekendsBusy: 'Mark Weekends as Busy',
    weekendsBusyError: 'Could not save your weekend setting',
    description: 'When someone looks for a rehearsal time,\nthey will see you as busy on those days.\nYou can still change any individual day\nin Availability.',
    note: `You can turn this on or off later in${NBSP}${PATH.en}`,
    no: 'No, Leave Them Free',
    weekendDefault: `Weekend day: busy by default. Change it like any other day, or turn off the default for all weekends in ${PATH.en}.`,
    skipMessage: 'You can choose the\u00a0first\u00a0day of\u00a0the\u00a0week, decide whether your\u00a0weekends are\u00a0marked\u00a0as\u00a0busy, and set\u00a0up calendar\u00a0sync at\u00a0any\u00a0time in\u00a0Profile\u00a0→\u00a0Settings.',
  },
  es: {
    weekendsBusy: 'Fines de semana ocupados',
    weekendsBusyError: 'No se pudo guardar el ajuste de los fines de semana',
    description: 'Así, cuando alguien busque un horario,\ntus fines de semana contarán como ocupados.\nPuedes cambiar cualquier día\npor separado en Disponibilidad.',
    note: `Puedes activarlo o${NBSP}desactivarlo más${NBSP}tarde en${NBSP}${PATH.es}`,
    no: 'No, dejarlos libres',
    weekendDefault: `Ocupado por defecto: cámbialo como cualquier otro día. Para desactivarlo en todos los fines de semana: ${PATH.es}.`,
    skipMessage: 'Puedes elegir el\u00a0inicio de\u00a0la\u00a0semana, decidir si\u00a0tus\u00a0fines\u00a0de\u00a0semana se\u00a0marcan como\u00a0ocupados y\u00a0configurar la\u00a0sincronización del\u00a0calendario cuando\u00a0quieras en\u00a0Perfil\u00a0→\u00a0Ajustes.',
  },
  de: {
    weekendsBusy: 'Wochenenden belegt',
    weekendsBusyError: 'Die Einstellung für die Wochenenden konnte nicht gespeichert werden',
    description: 'Dann gelten deine Wochenenden\nbei der Terminsuche als belegt.\nEinzelne Tage kannst du\nunter Verfügbarkeit ändern.',
    note: `Ein- und ausschalten kannst${NBSP}du${NBSP}das${NBSP}später unter${NBSP}${PATH.de}`,
    no: 'Nein, nicht markieren',
    weekendDefault: `Wochenendtag: standardmäßig belegt. Ändere ihn wie jeden anderen Tag oder schalte das für alle Wochenenden aus: ${PATH.de}.`,
    skipMessage: 'Du kannst jederzeit den\u00a0Wochenbeginn\u00a0ändern, die\u00a0Kalendersynchronisation einrichten und festlegen, ob\u00a0deine\u00a0Wochenenden als\u00a0belegt\u00a0gelten\u00a0– alles\u00a0unter\u00a0Profil\u00a0→\u00a0Einstellungen.',
  },
};

describe.each(LANGS)('the weekends in %s, as the native speaker wrote them (T-408)', (lang) => {
  const t = translations[lang];
  const want = EXPECTED[lang];

  it('the switch\'s label, the path to it with no break inside', () => {
    expect(t.profile.weekendsBusy).toBe(want.weekendsBusy);
    expect(pathOf(lang)).toBe(PATH[lang]);
  });

  it('the onboarding step', () => {
    expect(t.onboarding.weekends.description).toBe(want.description);
    expect(t.onboarding.weekends.note(pathOf(lang))).toBe(want.note);
    expect(t.onboarding.weekends.no).toBe(want.no);
  });

  it('П1: the error says the setting was not saved, not that the days were not moved', () => {
    expect(t.profile.weekendsBusyError).toBe(want.weekendsBusyError);
    expect(t.profile.weekendsBusyError).toMatch({ ru: /сохранить настройку/, en: /save your weekend setting/, es: /guardar el ajuste/, de: /Einstellung.*gespeichert/ }[lang]);
    expect(t.profile.weekendsBusyError).not.toMatch(/изменить выходные|change the weekends|cambiar los fines|Wochenenden konnten nicht geändert/);
  });

  it('П2: the editor\'s hint — the day changes as any day, the default goes off for all weekends', () => {
    const hint = t.availability.weekendDefault(pathOf(lang));
    expect(hint).toBe(want.weekendDefault);
    expect(hint).toMatch({ ru: /как любой день/, en: /like any other day/, es: /como cualquier otro día/, de: /wie jeden anderen Tag/ }[lang]);
    expect(hint).toMatch({ ru: /для всех выходных/, en: /for all weekends/, es: /en todos los fines de semana/, de: /für alle Wochenenden/ }[lang]);
    expect(hint.endsWith('.')).toBe(true);
  });

  it('П3: "Skip" names the weekends among what is set later in the Profile', () => {
    expect(t.onboarding.skipMessage).toBe(want.skipMessage);
    // Read by its words: the no-break spaces of T-417 are spaces too.
    expect(t.onboarding.skipMessage.replace(/\u00a0/g, ' ')).toMatch({ ru: /отмечать ли выходные занятыми/, en: /whether your weekends are marked as busy/, es: /si tus fines de semana se marcan como ocupados/, de: /ob deine Wochenenden als belegt gelten/ }[lang]);
  });

  it('the days in the question do not break inside: no-break spaces in the join', () => {
    const joined = t.profile.weekendDaysJoin('A', 'B');
    expect(joined).not.toMatch(/ /);
    expect(joined).toBe(`A${NBSP}${{ ru: 'и', en: 'and', es: 'y', de: 'und' }[lang]}${NBSP}B`);
    expect(t.profile.weekendDaysJoin('A', 'B', 'C')).not.toMatch(/ /);
  });
});

it('no weekends text has a line break of its own but the onboarding\'s question and description (T-412)', () => {
  const texts = LANGS.flatMap((lang) => {
    const t = translations[lang];
    return [t.profile.weekendsBusy, t.profile.weekendsBusyError,
      t.onboarding.weekends.note('P'), t.onboarding.weekends.yes, t.onboarding.weekends.no, t.availability.weekendDefault('P'), t.onboarding.skipMessage];
  });
  expect(texts.filter((text) => /[\n\r\u2028]/.test(text))).toEqual([]);
});
