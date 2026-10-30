/**
 * The warning before saving a rehearsal over someone's busy time was written
 * in Russian in the code (T-011): an English app said "Smirnov занят(а) в это
 * время". It is in the translations, in all four languages.
 */
import { formatConflictMessage, ConflictInfo } from '../conflictDetection';
import { translations, Language } from '../../../i18n/translations';

const member = (userId: string, firstName: string, lastName = '') =>
  ({ userId, firstName, lastName } as any);
const busy = { start: '10:00', end: '14:00', type: 'busy' } as any;
const conflict = (...members: any[]): ConflictInfo => ({
  hasConflicts: true,
  busyMembers: members.map((m) => ({ member: m, conflictingSlots: [busy] })),
});

it('says it in English to an English app', () => {
  const t = translations.en;
  expect(formatConflictMessage(conflict(member('1', 'Grigory', 'Smirnov')), t))
    .toBe('Grigory Smirnov is busy at this time');
  expect(formatConflictMessage(conflict(member('1', 'Olga'), member('2', 'Ivan')), t))
    .toBe('Olga, Ivan are busy at this time');
  // A member without a name is called one in the app's language.
  expect(formatConflictMessage(conflict(member('1', '')), t)).toBe('Member is busy at this time');
});

it('has no Cyrillic in any language but Russian', () => {
  for (const language of ['en', 'es', 'de'] as Language[]) {
    const t = translations[language];
    for (const info of [conflict(member('1', 'A')), conflict(member('1', 'A'), member('2', 'B')), conflict(member('1', ''))]) {
      expect(formatConflictMessage(info, t)).not.toMatch(/[А-Яа-яЁё]/);
    }
  }
  expect(formatConflictMessage(conflict(member('1', 'Ольга')), translations.ru)).toBe('Ольга занят(а) в это время');
});

it('says nothing when nobody is busy', () => {
  expect(formatConflictMessage({ hasConflicts: false, busyMembers: [] }, translations.en)).toBe('');
});
