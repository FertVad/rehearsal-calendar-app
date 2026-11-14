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
