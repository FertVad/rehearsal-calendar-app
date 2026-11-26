/**
 * The onboarding's texts as T-412 set them, word for word: the owner chose the
 * Russian of the calendar and notifications steps, the native speakers wrote
 * en, es and de and broke every description into lines by its sense — each
 * line no wider than 327 pt at 14 pt, so it holds on an iPhone SE too
 * (audit/evidence/T-412/natives.md). The calendar step is named for what it
 * is, calendar sync; the weekends' question is three lines, its days on one of
 * their own. And there is no "Next" left to say: a step goes on by its answers.
 */
import { translations } from '../translations';

type Lang = 'ru' | 'en' | 'es' | 'de';
const N = ' ';

const EXPECTED: Record<Lang, {
  welcome: string;
  question: string;
  weekends: string;
  calendarTitle: string;
  calendar: string;
  notifications: string;
}> = {
  ru: {
    welcome: 'Планируйте репетиции,\nуправляйте расписанием\nи синхронизируйте календари\nв одном месте.',
    question: 'Отметить все выходные\n(D)\nкак занятые?',
    weekends: 'Тогда при подборе времени\nваши выходные будут считаться занятыми.\nЛюбой выходной можно отметить иначе\nв «Занятости».',
    calendarTitle: 'Синхронизация календаря',
    calendar: 'Репетиции сами попадут в ваш календарь,\nа занятые часы из него — в Rehearsly.\nКоманда видит только эти часы,\nно не ваши дела.',
    notifications: 'Новая репетиция, отменили или перенесли —\nвы узнаете сразу.',
  },
  en: {
    welcome: 'Plan rehearsals, manage schedules,\nand sync calendars in one place.',
    question: 'Mark all weekends\n(D)\nas busy?',
    weekends: 'When someone looks for a rehearsal time,\nthey will see you as busy on those days.\nYou can still change any individual day\nin Availability.',
    calendarTitle: 'Calendar Sync',
    calendar: `Rehearsals appear in your calendar automatically,\nand Rehearsly picks up your busy hours from${N}it.\nYour team sees only those hours,\nnot what you’re doing.`,
    notifications: 'A new rehearsal, a new time, or a cancellation —\nyou’ll know right away.',
  },
  es: {
    welcome: 'Planifica ensayos, gestiona horarios\ny sincroniza calendarios en un solo lugar.',
    question: '¿Marcar como ocupados\ntodos los fines de semana\n(D)?',
    weekends: 'Así, cuando alguien busque un horario,\ntus fines de semana contarán como ocupados.\nPuedes cambiar cualquier día\npor separado en Disponibilidad.',
    calendarTitle: `Sincronización del${N}calendario`,
    calendar: 'Los ensayos aparecerán solos en tu calendario,\ny de él llegarán a Rehearsly tus horas ocupadas.\nEl equipo ve solo esas horas, no tus planes.',
    notifications: 'Ensayo nuevo, cancelado o reprogramado:\nte enterarás al instante.',
  },
  de: {
    welcome: 'Plane Proben, verwalte Termine\nund synchronisiere Kalender an einem Ort.',
    question: 'Alle Wochenenden\n(D)\nals belegt markieren?',
    weekends: 'Dann gelten deine Wochenenden\nbei der Terminsuche als belegt.\nEinzelne Tage kannst du\nunter Verfügbarkeit ändern.',
    calendarTitle: 'Kalender-Sync',
    calendar: 'Proben landen von selbst in deinem Kalender,\nbelegte Zeiten von dort in Rehearsly.\nDie anderen im Projekt sehen nur diese Zeiten,\naber nicht, was du vorhast.',
    notifications: `Neue Probe, Absage oder Verschiebung${N}–\ndu erfährst es sofort.`,
  },
};

describe.each(['ru', 'en', 'es', 'de'] as const)('the onboarding in %s, as T-412 set it', (lang) => {
  const o = translations[lang].onboarding;
  const want = EXPECTED[lang];

  it('the descriptions, in their lines', () => {
    expect(o.welcome.description).toBe(want.welcome);
    expect(o.weekends.description).toBe(want.weekends);
    expect(o.calendarSync.description).toBe(want.calendar);
    expect(o.notifications.description).toBe(want.notifications);
  });

  it('the weekends\' question in three lines, the days on one of their own', () => {
    expect(o.weekends.question('D')).toBe(want.question);
    expect(o.weekends.question('D').split('\n')).toContain(lang === 'es' ? '(D)?' : '(D)');
  });

  it('the calendar step named for calendar sync', () => {
    expect(o.calendarSync.title).toBe(want.calendarTitle);
  });

  it('a line never begins with a dash', () => {
    for (const text of [want.welcome, want.weekends, want.calendar, want.notifications]) {
      expect(text.split('\n').filter((line) => /^[–—→…]/.test(line))).toEqual([]);
    }
  });

  it('no "Next" left', () => {
    expect('next' in o).toBe(false);
    expect('next' in o.calendarSync).toBe(false);
  });
});
