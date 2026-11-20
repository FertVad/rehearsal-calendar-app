/**
 * The hint under the avatar says what the avatar is made of (T-272).
 *
 * Before: every language said it was made from the email address, while
 * UserAvatar draws the initials of the first and last name on a colour taken
 * from the name — the address is never read. The hint now names the initials.
 */
import { translations } from '../translations';

const EMAIL = /e-?mail|почт|correo/i;
const INITIALS: Record<'ru' | 'en' | 'es' | 'de', RegExp> = {
  ru: /инициал/i,
  en: /initials/i,
  es: /iniciales/i,
  de: /Initialen/,
};

it.each(Object.keys(INITIALS) as Array<keyof typeof INITIALS>)('%s: the avatar hint names the initials, not the email', (lang) => {
  const hint = translations[lang].profile.avatarHint;
  expect(hint).not.toMatch(EMAIL);
  expect(hint).toMatch(INITIALS[lang]);
});
