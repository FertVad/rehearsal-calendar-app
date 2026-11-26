/**
 * T-417: where iOS may break the onboarding's lines, as the native speakers of
 * ru, en, es and de measured them (TextKit, SF Pro, the step's columns at 393 pt
 * and on the SE, the alerts of iOS 26 and of iOS 18). Each string is here word
 * for word, "⍽" for a no-break space (U+00A0) and "\n" for a break of its own.
 *
 * - The steps' texts: a group of words by its sense goes on one line — a
 *   clause, a preposition with what it points to, a path in "What's Where".
 * - "What's Where" keeps a label whole (its plain spaces no-break) where the
 *   language's native speaker said so; Russian "Присоединиться по коду" is not
 *   whole: at a large size a whole label breaks worse.
 * - The alerts ("Skip", the calendar's access) end a sentence with its mark
 *   (HIG, Alerts); the English title, a sentence, is in sentence case.
 */
import { translations } from '../translations';

type Lang = 'ru' | 'en' | 'es' | 'de';
const LANGS: Lang[] = ['ru', 'en', 'es', 'de'];
const nb = (text: string) => text.replace(/⍽/g, '\u00a0');

/** What every string says, its arguments a path "P". */
const strings = (lang: Lang) => {
  const t = translations[lang];
  const o = t.onboarding;
  return {
    'welcome.feature1': o.welcome.feature1,
    'welcome.feature2': o.welcome.feature2,
    'welcome.feature3': o.welcome.feature3,
    'notifications.exampleAdded': o.notifications.exampleAdded,
    'notifications.exampleTimeChanged': o.notifications.exampleTimeChanged,
    'weekends.note': o.weekends.note('P'),
    'calendarSync.laterWhere': o.calendarSync.laterWhere('P'),
    skipTitle: o.skipTitle,
    skipMessage: o.skipMessage,
    'calendarSync.permissionRequired': o.calendarSync.permissionRequired,
    permissionDeniedMessage: t.calendarSync.permissionDeniedMessage,
    // Assembled as the step assembles them, with the app's own labels.
    projectWhere: o.whatWhere.projectWhere(t.actionSheet.createProject, t.nav.projects, t.projects.haveInvite),
    rehearsalWhere: o.whatWhere.rehearsalWhere(t.actionSheet.createRehearsal),
    availabilityWhere: o.whatWhere.availabilityWhere(t.actionSheet.markBusy),
    plannerWhere: o.whatWhere.plannerWhere(t.smartPlanner.title),
  };
};

const EXPECTED: Record<Lang, ReturnType<typeof strings>> = {
  ru: {
    'welcome.feature1': 'Все отмечают, когда заняты',
    'welcome.feature2': 'Rehearsly находит⍽время, когда⍽свободны⍽все',
    'welcome.feature3': 'Репетиция уходит всем в календарь',
    'notifications.exampleAdded': 'Вас позвали на репетицию',
    'notifications.exampleTimeChanged': 'Время репетиции изменилось',
    'weekends.note': 'Это можно включить⍽или⍽выключить позже: P',
    'calendarSync.laterWhere': 'Это можно сделать потом: P',
    skipTitle: 'Настройки доступны в⍽профиле',
    skipMessage: 'Начало недели, синхронизацию⍽календаря и⍽то, отмечать⍽ли выходные⍽занятыми, можно⍽настроить в⍽любое⍽время: Профиль⍽→⍽Настройки.',
    'calendarSync.permissionRequired': 'Требуется разрешение',
    permissionDeniedMessage: 'Для этого нужен доступ к⍽календарю.',
    projectWhere: '«+»⍽→⍽«Создать⍽проект». По⍽приглашению: «Проекты»⍽→⍽«Присоединиться по коду»',
    rehearsalWhere: '«+»⍽→⍽«Создать⍽репетицию»,\nв⍽проектах, где⍽вы⍽администратор',
    availabilityWhere: '«+» → «Отметить⍽занятость»',
    plannerWhere: '«Smart⍽Planner» под календарём',
  },
  en: {
    'welcome.feature1': 'Everyone marks when⍽they⍽are⍽busy',
    'welcome.feature2': 'Rehearsly finds the⍽hours that⍽suit⍽all⍽of⍽you',
    'welcome.feature3': 'The rehearsal lands in⍽everyone’s⍽calendar',
    'notifications.exampleAdded': 'You Were Added to⍽a⍽Rehearsal',
    'notifications.exampleTimeChanged': 'Rehearsal Time Changed',
    'weekends.note': 'You can turn this on or off later in⍽P',
    'calendarSync.laterWhere': 'You can do it later in⍽P',
    skipTitle: 'Settings are in⍽your⍽profile.',
    skipMessage: 'You can choose the⍽first⍽day of⍽the⍽week, decide whether your⍽weekends are⍽marked⍽as⍽busy, and set⍽up calendar⍽sync at⍽any⍽time in⍽Profile⍽→⍽Settings.',
    'calendarSync.permissionRequired': 'Permission Required',
    permissionDeniedMessage: 'Calendar access is required to⍽use⍽this⍽feature.',
    projectWhere: '“+”⍽→⍽“Create⍽Project”.\nInvited? “Projects”⍽→⍽“Join⍽with⍽a⍽Code”',
    rehearsalWhere: '“+”⍽→⍽“Create⍽Rehearsal”,\nin⍽projects where⍽you⍽are⍽an⍽admin',
    availabilityWhere: '“+” → “Mark⍽Busy”',
    plannerWhere: '“Smart⍽Planner”, under⍽the⍽calendar',
  },
  es: {
    'welcome.feature1': 'Cada uno marca sus⍽horas⍽ocupadas',
    'welcome.feature2': 'Rehearsly encuentra las⍽horas que⍽les⍽sirven⍽a⍽todos',
    'welcome.feature3': 'El ensayo llega al⍽calendario⍽de⍽cada⍽uno',
    'notifications.exampleAdded': 'Te han añadido a un ensayo',
    'notifications.exampleTimeChanged': 'Cambió la hora de un ensayo',
    'weekends.note': 'Puedes activarlo o⍽desactivarlo más⍽tarde en⍽P',
    'calendarSync.laterWhere': 'Puedes hacerlo después en⍽P',
    skipTitle: 'Ajustes disponibles en⍽el⍽perfil',
    skipMessage: 'Puedes elegir el⍽inicio de⍽la⍽semana, decidir si⍽tus⍽fines⍽de⍽semana se⍽marcan como⍽ocupados y⍽configurar la⍽sincronización del⍽calendario cuando⍽quieras en⍽Perfil⍽→⍽Ajustes.',
    'calendarSync.permissionRequired': 'Permiso requerido',
    permissionDeniedMessage: 'Se requiere acceso⍽al⍽calendario para⍽usar⍽esta⍽función.',
    projectWhere: '«+»⍽→⍽«Crear⍽proyecto». Con⍽una⍽invitación: «Proyectos»⍽→⍽«Unirse⍽con⍽un⍽código»',
    rehearsalWhere: '«+»⍽→⍽«Crear⍽ensayo», en⍽los⍽proyectos⍽que⍽administras',
    availabilityWhere: '«+» → «Marcar⍽horas⍽ocupadas»',
    plannerWhere: '«Smart⍽Planner», debajo⍽del⍽calendario',
  },
  de: {
    'welcome.feature1': 'Alle tragen ein, wann⍽sie⍽beschäftigt⍽sind',
    'welcome.feature2': 'Rehearsly findet die⍽Stunden, die⍽allen⍽passen',
    'welcome.feature3': 'Die Probe landet bei⍽allen⍽im⍽Kalender',
    'notifications.exampleAdded': 'Du wurdest für⍽eine⍽Probe⍽eingeteilt',
    'notifications.exampleTimeChanged': 'Die Zeit einer Probe hat⍽sich⍽geändert',
    // No no-break space in "Ein- und": iOS breaks after the hyphen anyway, and it would begin the line.
    'weekends.note': 'Ein- und ausschalten kannst⍽du⍽das⍽später unter⍽P',
    'calendarSync.laterWhere': 'Das geht auch später unter⍽P',
    skipTitle: 'Einstellungen im⍽Profil⍽verfügbar',
    skipMessage: 'Du kannst jederzeit den⍽Wochenbeginn⍽ändern, die⍽Kalendersynchronisation einrichten und festlegen, ob⍽deine⍽Wochenenden als⍽belegt⍽gelten⍽– alles⍽unter⍽Profil⍽→⍽Einstellungen.',
    'calendarSync.permissionRequired': 'Berechtigung erforderlich',
    permissionDeniedMessage: 'Für diese Funktion ist Kalenderzugriff⍽erforderlich.',
    // No no-break space after the first arrow: a path that starts a line breaks best after it.
    projectWhere: '„+“⍽→ „Projekt⍽erstellen“. Per⍽Einladung:\n„Projekte“⍽→ „Mit⍽einem⍽Code⍽beitreten“',
    rehearsalWhere: '„+“⍽→ „Probe⍽erstellen“, in⍽Projekten, in⍽denen⍽du⍽Admin⍽bist',
    availabilityWhere: '„+“ → „Als⍽beschäftigt⍽markieren“',
    plannerWhere: '„Smart⍽Planner“ unter⍽dem⍽Kalender',
  },
};

describe.each(LANGS)('the onboarding\'s lines in %s, as its native speaker set them (T-417)', (lang) => {
  const got = strings(lang);
  it.each(Object.keys(EXPECTED[lang]) as Array<keyof ReturnType<typeof strings>>)('%s', (key) => {
    expect(got[key]).toBe(nb(EXPECTED[lang][key]));
  });
});

it('"What\'s Where" keeps a label whole where the native speaker said so; not Russian "Присоединиться по коду"', () => {
  const whole = (label: string) => label.replace(/ /g, '\u00a0');
  for (const lang of LANGS) {
    const t = translations[lang];
    const w = t.onboarding.whatWhere;
    expect(w.projectWhere('A b', 'C', 'D e')).toContain(whole('A b'));
    expect(w.rehearsalWhere('A b c')).toContain(whole('A b c'));
    expect(w.availabilityWhere('A b c')).toContain(whole('A b c'));
    expect(w.plannerWhere('A b')).toContain(whole('A b'));
    expect(w.projectWhere('A', 'C', 'D e f')).toContain(lang === 'ru' ? 'D e f' : whole('D e f'));
  }
});

it('a label is whole only in "What\'s Where": the buttons keep it as it is', () => {
  for (const lang of LANGS) {
    const t = translations[lang];
    for (const label of [t.actionSheet.createProject, t.actionSheet.createRehearsal, t.actionSheet.markBusy, t.projects.haveInvite, t.smartPlanner.title]) {
      expect(label).not.toMatch(/\u00a0/);
    }
  }
});

it('the alerts\' texts end a sentence with its mark (HIG, Alerts)', () => {
  for (const lang of LANGS) {
    expect(translations[lang].calendarSync.permissionDeniedMessage).toMatch(/\.$/);
    expect(translations[lang].onboarding.skipMessage).toMatch(/\.$/);
  }
  // A title that is a sentence: sentence case and its full stop.
  expect(translations.en.onboarding.skipTitle).toBe(nb('Settings are in⍽your⍽profile.'));
});
