/**
 * What the proofreading of T-250 fixed in words a screen builds, held here:
 * flows 84 and 89 show them on the phone, these keep every form of them.
 */
import { translations } from '../translations';

const { ru, en, es, de } = translations;

describe('A person\'s name is the subject, so it stays as stored (T-250)', () => {
  // The screen passes the name as the account has it, in the nominative:
  // "удалить Анна Смирнова", "у Анна Смирнова" were no Russian.
  it('Russian puts the name where the nominative belongs', () => {
    expect(ru.projects.removeMemberMessage('Анна Смирнова')).toBe('Анна Смирнова больше не будет участником проекта.');
    expect(ru.projects.makeAdminMessage('Анна Смирнова')).toBe('Анна Смирнова станет администратором проекта.');
    expect(ru.projects.removeAdminMessage('Анна Смирнова')).toBe('Анна Смирнова больше не будет администратором проекта.');
  });

  it('nobody busy is given a gender: "не может", "no puede", not "занят(а)", "ocupado/a"', () => {
    expect(ru.rehearsals.busyAtThisTime('Тихон Кабанов', 1)).toBe('В это время не может: Тихон Кабанов');
    expect(ru.rehearsals.busyAtThisTime('Тихон Кабанов, Варвара', 2)).toBe('В это время не могут: Тихон Кабанов, Варвара');
    expect(es.rehearsals.busyAtThisTime('Tikhon', 1)).toBe('Tikhon no puede a esa hora');
    expect(es.rehearsals.busyAtThisTime('Tikhon, Varvara', 2)).toBe('Tikhon, Varvara no pueden a esa hora');
  });
});

// The native speakers' reading of T-256, its tails (T-258).
describe('The planner\'s slot names its busy people by their number (T-258)', () => {
  // "Заняты: Анна Иванова", "No disponibles: Laura" put one person in the
  // plural; "не может" has no gender, as busyAtThisTime.
  it('Russian and Spanish agree with one person and with two', () => {
    expect(ru.smartPlanner.busyPrefix(1)).toBe('Не может');
    expect(ru.smartPlanner.busyPrefix(2)).toBe('Не могут');
    expect(es.smartPlanner.busyPrefix(1)).toBe('No disponible');
    expect(es.smartPlanner.busyPrefix(2)).toBe('No disponibles');
  });

  it('English and German have one word for any number', () => {
    expect(en.smartPlanner.busyPrefix(1)).toBe('Busy');
    expect(en.smartPlanner.busyPrefix(2)).toBe('Busy');
    expect(de.smartPlanner.busyPrefix(1)).toBe('Beschäftigt');
    expect(de.smartPlanner.busyPrefix(2)).toBe('Beschäftigt');
  });
});

describe('The onboarding says "по коду" once (T-258)', () => {
  it('Russian joins a project "По приглашению"', () => {
    expect(ru.onboarding.whatWhere.projectWhere('Создать проект', 'Проекты', 'Присоединиться по коду'))
      .toBe('«+» → «Создать проект». По приглашению: «Проекты» → «Присоединиться по коду»');
  });
});

describe('German counts one more busy person as iOS does: "und 1 weiterer" (T-258)', () => {
  // "und 1 weitere Person" was cut on the phone (flow 95); masculine after
  // "Teilnehmer", as everywhere in the app.
  it('one and more', () => {
    expect(de.rehearsals.andMore(1)).toBe('und 1 weiterer');
    expect(de.rehearsals.andMore(2)).toBe('und 2 weitere');
    expect(de.rehearsals.andMore(3)).toBe('und 3 weitere');
  });
});

describe('After "Account deleted", the projects deleted with it: done, not to come (T-250)', () => {
  const ruSaid = (n: number) => ru.profile.deleteAccountProjectsWarning(n);

  it('Russian agrees with the number, in the past', () => {
    expect(ruSaid(1)).toBe('Также удалён 1 проект, где вы были единственным администратором.');
    expect(ruSaid(21)).toBe('Также удалён 21 проект, где вы были единственным администратором.');
    expect(ruSaid(2)).toBe('Также удалены 2 проекта, где вы были единственным администратором.');
    expect(ruSaid(24)).toBe('Также удалены 24 проекта, где вы были единственным администратором.');
    expect(ruSaid(5)).toBe('Также удалено 5 проектов, где вы были единственным администратором.');
    expect(ruSaid(11)).toBe('Также удалено 11 проектов, где вы были единственным администратором.');
    expect(ruSaid(12)).toBe('Также удалено 12 проектов, где вы были единственным администратором.');
  });

  it('English, Spanish and German say it happened', () => {
    expect(en.profile.deleteAccountProjectsWarning(1)).toBe('1 project where you were the only admin was deleted too.');
    expect(en.profile.deleteAccountProjectsWarning(2)).toBe('2 projects where you were the only admin were deleted too.');
    expect(es.profile.deleteAccountProjectsWarning(1)).toBe('También se ha eliminado 1 proyecto que solo administrabas tú.');
    expect(es.profile.deleteAccountProjectsWarning(2)).toBe('También se han eliminado 2 proyectos que solo administrabas tú.');
    expect(de.profile.deleteAccountProjectsWarning(1)).toBe('1 Projekt, das nur du verwaltet hast, wurde ebenfalls gelöscht.');
    expect(de.profile.deleteAccountProjectsWarning(2)).toBe('2 Projekte, die nur du verwaltet hast, wurden ebenfalls gelöscht.');
  });
});

// Maestro matches text without regard to case, so the case is held here.
describe('English buttons and alert titles are in title case, as Apple writes them (T-250)', () => {
  it.each([
    ['the inbox\'s Clear All', en.notifications.clearAll, 'Clear All'],
    ['the inbox\'s Show Older', en.notifications.showOlder, 'Show Older'],
    ['the availability alert\'s title', en.availability.cannotSave, 'Cannot Save'],
  ])('%s', (_where, said, expected) => {
    expect(said).toBe(expected);
  });
});

/**
 * The native speakers' reading of T-256, as far as Maestro cannot hold it:
 * the case of English titles and buttons, every form a number takes, and the
 * typography of every string in the app.
 */
describe('English titles, buttons and labels in Title Case, as Apple writes them (T-256)', () => {
  it.each([
    ['the inbox\'s Mark All Read', en.notifications.markAllRead, 'Mark All Read'],
    ['the inbox\'s empty title', en.notifications.empty, 'No Notifications Yet'],
    ['the planner\'s empty title', en.smartPlanner.noSlots, 'Nothing to Show Yet'],
    ['the availability editor\'s Busy Time', en.availability.busyTime, 'Busy Time'],
    ['the availability editor\'s Start Time', en.availability.startTime, 'Start Time'],
    ['the availability editor\'s End Time', en.availability.endTime, 'End Time'],
    ['the availability editor\'s heading over the calendar', en.availability.fromCalendar, 'Already Scheduled'],
    ['the sync screen\'s Calendar Access Required', en.calendarSync.permissionRequired, 'Calendar Access Required'],
    ['the sync screen\'s Sync Now', en.calendarSync.synchronize, 'Sync Now'],
    ['the sync screen\'s Remove Exported Rehearsals', en.calendarSync.removeAll, 'Remove Exported Rehearsals'],
    ['What’s Where: Finding a Time', en.onboarding.whatWhere.planner, 'Finding a Time'],
    ['the onboarding\'s example push', en.onboarding.notifications.exampleAdded, 'You Were Added to a Rehearsal'],
    ['the onboarding\'s second example push', en.onboarding.notifications.exampleTimeChanged, 'Rehearsal Time Changed'],
    ['the profile\'s Change Email', en.profile.changeEmail, 'Change Email'],
    ['the change of address\'s New Email', en.profile.newEmail, 'New Email'],
    ['the change of address\'s Current Password', en.profile.currentPassword, 'Current Password'],
    ['the profile\'s Start Week On', en.profile.weekStart, 'Start Week On'],
    ['the reset\'s New Password', en.auth.newPassword, 'New Password'],
    ['the code\'s Use Another Email', en.auth.otherAddress, 'Use Another Email'],
    ['the invitation\'s Invite Code', en.projects.inviteCodeLabel, 'Invite Code'],
    ['the date picker\'s Select Dates', en.common.selectPeriod, 'Select Dates'],
  ])('%s', (_where, said, expected) => {
    expect(said).toBe(expected);
  });
});

describe('A number takes its noun\'s form (T-256)', () => {
  it('Russian: who will be told of a cancellation', () => {
    expect(ru.rehearsals.deleteNotifies(1)).toBe('Уведомление получит 1 участник');
    expect(ru.rehearsals.deleteNotifies(21)).toBe('Уведомление получит 21 участник');
    expect(ru.rehearsals.deleteNotifies(2)).toBe('Уведомление получат 2 участника');
    expect(ru.rehearsals.deleteNotifies(24)).toBe('Уведомление получат 24 участника');
    expect(ru.rehearsals.deleteNotifies(5)).toBe('Уведомление получат 5 участников');
    expect(ru.rehearsals.deleteNotifies(11)).toBe('Уведомление получат 11 участников');
    expect(ru.rehearsals.deleteNotifies(12)).toBe('Уведомление получат 12 участников');
  });

  it('English, Spanish and German: one and many', () => {
    expect(en.rehearsals.deleteNotifies(1)).toBe('1 participant will be notified');
    expect(en.rehearsals.deleteNotifies(5)).toBe('5 participants will be notified');
    expect(es.rehearsals.deleteNotifies(1)).toBe('1 participante recibirá una notificación');
    expect(es.rehearsals.deleteNotifies(5)).toBe('5 participantes recibirán una notificación');
    expect(de.rehearsals.deleteNotifies(1)).toBe('1 Teilnehmer wird benachrichtigt');
    expect(de.rehearsals.deleteNotifies(5)).toBe('5 Teilnehmer werden benachrichtigt');
    expect(de.rehearsals.andMore(1)).toBe('und 1 weitere Person');
    expect(de.rehearsals.andMore(3)).toBe('und 3 weitere');
    expect(en.auth.passwordHint(1)).toBe('At least 1 character');
    expect(en.auth.resendIn(1)).toBe('You can ask for a new code in 1 second');
    expect(en.auth.rateLimited(30)).toBe('Wait 30 seconds and try again.');
    expect(en.common.dateRangeTooLong(1)).toBe('Choose a range of up to 1 day, including the first and last day.');
    expect(de.common.dateRangeTooLong(1)).toBe('Wähle einen Zeitraum von höchstens 1 Tag, einschließlich des ersten und letzten Tages.');
    expect(en.calendarSync.removeAllPartial(3, 1)).toBe('Removed: 3. Could not remove: 1 — that event is still in the calendar.');
    expect(es.calendarSync.removeAllPartial(3, 1)).toBe('Eliminados: 3. Un evento no se pudo eliminar y sigue en el calendario.');
    expect(es.calendarSync.removeAllPartial(3, 2)).toBe('Eliminados: 3. 2 eventos no se pudieron eliminar y siguen en el calendario.');
  });

  it('one person or several, without a gender', () => {
    expect(ru.smartPlanner.unknownAvailability('Анна Иванова')).toBe('Нет данных о занятости: Анна Иванова. Без отметок участник считается свободным.');
    expect(es.smartPlanner.unknownAvailability('Ana')).toBe('Sin datos de disponibilidad: Ana. Quien no marca nada cuenta como libre.');
    expect(de.smartPlanner.unknownAvailability('Jo')).toBe('Keine Verfügbarkeit hinterlegt: Jo. Wer nichts eingetragen hat, zählt als frei.');
    expect(en.rehearsals.busyAtThisTime('Anna Smith, Boris Ivanov', 2)).toBe('Busy at this time: Anna Smith, Boris Ivanov');
  });

  it('yesterday is yesterday', () => {
    expect(ru.calendarSync.daysAgo(1)).toBe('вчера');
    expect(de.calendarSync.daysAgo(1)).toBe('gestern');
    expect(de.calendarSync.daysAgo(3)).toBe('vor 3 Tagen');
    expect(de.notifications.daysAgo(3)).toBe('vor 3 Tagen');
  });
});

describe('Words around what the user typed (T-256)', () => {
  it('a project\'s name in quotes after "project"', () => {
    expect(ru.projects.shareInviteTitle('Весна 2026')).toBe('Приглашение в проект «Весна 2026»');
    expect(de.projects.shareInviteTitle('Die Räuber')).toBe('Einladung zum Projekt „Die Räuber“');
  });

  it('German puts the verb last', () => {
    expect(de.rehearsals.deleteTitle('Durchlauf 2. Akt', 'Do., 29. Okt., 18:00')).toBe('„Durchlauf 2. Akt“ (Do., 29. Okt., 18:00) löschen?');
    expect(de.rehearsals.deleteTitle(null, 'Do., 29. Okt., 18:00')).toBe('Probe (Do., 29. Okt., 18:00) löschen?');
    expect(de.smartPlanner.addRehearsalAt('18:00–21:00')).toBe('Probe für 18:00–21:00 hinzufügen');
    expect(de.rehearsals.busyAt('Anna', '18:00–20:00')).toBe('Anna: 18:00–20:00 beschäftigt');
  });

  it('Spanish quotes are « » everywhere', () => {
    expect(es.onboarding.whatWhere.projectWhere('Crear proyecto', 'Proyectos', 'Unirse con un código'))
      .toBe('«+» → «Crear proyecto». Con un código: «Proyectos» → «Unirse con un código»');
    expect(es.onboarding.whatWhere.plannerWhere('Planner')).toBe('«Planner», debajo del calendario');
  });
});

/** Every string of a language, and every function's at a sample value. */
const everyString = (node: unknown, path: string, out: Array<[string, string]>): Array<[string, string]> => {
  if (typeof node === 'string') out.push([path, node]);
  else if (typeof node === 'function') {
    const said = (node as (...args: unknown[]) => unknown)(2, 3);
    if (typeof said === 'string') out.push([path, said]);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) everyString(value, `${path}.${key}`, out);
  }
  return out;
};

describe('Typography (T-256)', () => {
  it.each(['ru', 'en', 'es', 'de'] as const)('%s: an ellipsis is one character, not three dots', (lang) => {
    const dots = everyString(translations[lang], lang, []).filter(([, said]) => said.includes('...'));
    expect(dots.map(([path]) => path)).toEqual([]);
  });

  it('English apostrophes are typographic', () => {
    const straight = everyString(en, 'en', []).filter(([, said]) => said.includes("'"));
    expect(straight.map(([path]) => path)).toEqual([]);
  });

  it('German puts a no-break space before its ellipsis', () => {
    const loose = everyString(de, 'de', []).filter(([, said]) => /[^\u00a0]…/.test(said));
    expect(loose.map(([path]) => path)).toEqual([]);
  });
});
