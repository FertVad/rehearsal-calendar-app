/**
 * A full stop left out in one language is seen by no one (T-263): if the
 * English string ends a sentence (. ! ? …), the string under the same key in
 * ru, es and de ends one too. Closing quotes and brackets after the mark do not
 * count. There is no reverse rule: "día sig.", "Std." and the German question
 * "Was möchtest du tun?" for "Quick Actions" are right and are not checked.
 *
 * Every string and every function in src/i18n/translations/ is read; a function
 * is called with the sample arguments below, all of them, so each plural branch
 * is checked. A new function without samples fails the last test.
 */
import { translations } from '../translations';

const { ru, en, es, de } = translations;

type Fn = (...args: unknown[]) => unknown;

const COUNTS: unknown[][] = [[0], [1], [2], [3], [5], [11], [21], [22], [25]];
const NAME: unknown[][] = [['Ghost watch']];
const EMAIL: unknown[][] = [['maya@example.com']];

// Sample arguments for every function, by key.
const SAMPLES: Record<string, unknown[][]> = {
  'common.dateRangeTooLong': COUNTS,
  'auth.passwordHint': COUNTS,
  'auth.verifySubtitle': EMAIL,
  'auth.resendIn': COUNTS,
  'auth.rateLimited': COUNTS,
  'auth.verifySubtitleUnsent': EMAIL,
  'auth.resetCodeSent': EMAIL,
  'rehearsals.deleteTitle': [['Fight scene', 'Sat, Aug 22, 7:00 PM'], [null, 'Sat, Aug 22, 7:00 PM']],
  'rehearsals.deleteNotifies': COUNTS,
  'rehearsals.busyAtThisTime': [['Maya Lopez', 1], ['Maya Lopez, Wang Wasser', 2], ['A, B, C, D, E', 5]],
  'rehearsals.seenCount': COUNTS,
  'rehearsals.participantsCount': [[1, 5], [2, 21]],
  'rehearsals.participantsEveryone': COUNTS,
  'rehearsals.busyAt': [['Maya Lopez', '6:00 PM–9:00 PM']],
  'rehearsals.andMore': COUNTS,
  'projects.shareInviteMessage': NAME,
  'projects.shareInviteTitle': NAME,
  'projects.removeMemberMessage': [['Maya Lopez']],
  'projects.makeAdminMessage': [['Maya Lopez']],
  'projects.removeAdminMessage': [['Maya Lopez']],
  'projects.deleteProjectMessage': NAME,
  'projects.leaveProjectMessage': NAME,
  'profile.deleteAccountProjectsWarning': COUNTS,
  'profile.changeEmailSubtitle': EMAIL,
  'profile.currentAddressCode': EMAIL,
  'profile.newAddressCode': EMAIL,
  'profile.deliveryFailedTo': EMAIL,
  'profile.deliveryUnknownTo': EMAIL,
  'profile.emailChanged': EMAIL,
  'availability.selectedDates': COUNTS,
  'smartPlanner.slotsCount': COUNTS,
  'smartPlanner.unknownAvailability': [['Maya Lopez, Wang Wasser']],
  'smartPlanner.addRehearsalAt': [['6:00 PM']],
  'smartPlanner.busyPrefix': [[]],
  'calendarSync.syncedAgo': [['yesterday']],
  'calendarSync.inCalendar': COUNTS,
  'calendarSync.removeAllPartial': [[5, 1], [5, 2], [21, 21]],
  'calendarSync.importIncomplete': [['Work, Family']],
  'calendarSync.exportIncomplete': [['Fight scene, Act II']],
  'calendarSync.minutesAgo': COUNTS,
  'calendarSync.hoursAgo': COUNTS,
  'calendarSync.daysAgo': COUNTS,
  'calendarSync.eventTitle': [['Hamlet']],
  'calendarSync.eventNotes': [['Hamlet']],
  'notifications.minutesAgo': COUNTS,
  'notifications.hoursAgo': COUNTS,
  'notifications.daysAgo': COUNTS,
  'onboarding.welcome.greeting': [['Maya'], [null]],
  'onboarding.calendarSync.laterWhere': [['Profile → Settings']],
  'onboarding.whatWhere.projectWhere': [['Create Project', 'Projects', 'Join with a Code']],
  'onboarding.whatWhere.rehearsalWhere': [['Create Rehearsal']],
  'onboarding.whatWhere.availabilityWhere': [['Mark Availability']],
  'onboarding.whatWhere.plannerWhere': [['Planner']],
};

// Strings that end a sentence in English and rightly do not in another language,
// with the reason. Empty: every string the rule found was a missing full stop.
const EXCEPTIONS: Record<string, string> = {};

function leaves(node: unknown, path: string, out: Map<string, unknown>): Map<string, unknown> {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  } else {
    out.set(path, node);
  }
  return out;
}

const CLOSERS = /[\s"'”“»«’‘›‹)\]}]+$/u;
const endsSentence = (s: string) => /[.!?…]$/u.test(s.replace(CLOSERS, ''));

// Every string to compare, by key: plain strings once, functions once per sample.
function texts(lang: typeof en): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of leaves(lang, '', new Map())) {
    if (typeof value === 'string') out.set(key, value);
    else if (typeof value === 'function') {
      (SAMPLES[key] ?? []).forEach((args) => {
        out.set(`${key}(${args.map((a) => JSON.stringify(a)).join(', ')})`, String((value as Fn)(...args)));
      });
    }
  }
  return out;
}

describe('T-263: a sentence that ends in English ends in every language', () => {
  const english = texts(en);

  it('the rule reads the marks it should', () => {
    expect(endsSentence('Done.')).toBe(true);
    expect(endsSentence('Delete “Fight scene”?')).toBe(true);
    expect(endsSentence('¿Eliminar «Escena»?')).toBe(true);
    expect(endsSentence('Wait…')).toBe(true);
    expect(endsSentence('„Szene“ löschen?“')).toBe(true);
    expect(endsSentence('(Sa., 22. Aug.)')).toBe(true);
    expect(endsSentence('Delete “Fight scene.”')).toBe(true);
    expect(endsSentence('… en Perfil → Ajustes')).toBe(false);
    expect(endsSentence('„Szene am Fenster“')).toBe(false);
  });

  it.each([['ru', ru], ['es', es], ['de', de]] as const)('%s', (_name, lang) => {
    const other = texts(lang);
    const missing: string[] = [];
    for (const [key, text] of english) {
      if (!endsSentence(text) || EXCEPTIONS[key]) continue;
      const theirs = other.get(key);
      if (theirs !== undefined && !endsSentence(theirs)) missing.push(`${key}: ${theirs}`);
    }
    expect(missing).toEqual([]);
  });

  it('every function has sample arguments, and every exception is still a string', () => {
    const functions = [...leaves(en, '', new Map())].filter(([, v]) => typeof v === 'function').map(([k]) => k);
    expect(functions.filter((k) => !SAMPLES[k])).toEqual([]);
    expect(Object.keys(SAMPLES).filter((k) => !functions.includes(k))).toEqual([]);
    expect(Object.keys(EXCEPTIONS).filter((k) => !english.has(k))).toEqual([]);
  });
});
