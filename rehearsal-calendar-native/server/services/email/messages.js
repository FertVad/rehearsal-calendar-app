/**
 * The emails Rehearsly sends, in the four languages of the app, plain text.
 * Each language is written on its own terms, as on the landing page, and uses
 * the app's form of address (du, tú). The code sits in the subject so it can be
 * read off a notification.
 */
import { LOCALES } from '../../utils/accountInput.js';

const SUPPORT = 'support@rehearsly.me';

const text = {
  en: {
    subject: (code) => `${code} is your Rehearsly code`,
    verify: (code) => `Enter ${code} in Rehearsly to confirm this email address. The code works for 15 minutes.\n\nIf you did not create a Rehearsly account, ignore this email. Nothing happens without the code.`,
    reset: (code) => `Enter ${code} in Rehearsly to set a new password. The code works for 15 minutes.\n\nIf you did not ask to reset your password, ignore this email. Your password stays as it is.`,
    change: (code) => `Enter ${code} in Rehearsly to sign in with this address from now on. The code works for 15 minutes.\n\nIf you did not ask for this, ignore this email.`,
    confirm: (code) => `Enter ${code} in Rehearsly to confirm that you are changing the address you sign in with. The code works for 15 minutes.\n\nIf you are not changing it, ignore this email. Your address stays as it is.`,
    changedSubject: 'Your Rehearsly sign-in address was changed',
    changed: (address) => `The email address of your Rehearsly account is now ${address}. You sign in with it from now on.\n\nIf this was not you, write to ${SUPPORT}.`,
  },
  ru: {
    subject: (code) => `${code} — ваш код Rehearsly`,
    verify: (code) => `Введите ${code} в Rehearsly, чтобы подтвердить этот адрес. Код действует 15 минут.\n\nЕсли вы не регистрировались в Rehearsly, просто проигнорируйте письмо: без кода ничего не произойдёт.`,
    reset: (code) => `Введите ${code} в Rehearsly, чтобы задать новый пароль. Код действует 15 минут.\n\nЕсли вы не просили сбросить пароль, проигнорируйте письмо: пароль останется прежним.`,
    change: (code) => `Введите ${code} в Rehearsly, чтобы входить с этим адресом. Код действует 15 минут.\n\nЕсли вы этого не просили, проигнорируйте письмо.`,
    confirm: (code) => `Введите ${code} в Rehearsly, чтобы подтвердить смену адреса для входа. Код действует 15 минут.\n\nЕсли вы ничего не меняете, проигнорируйте письмо: адрес останется прежним.`,
    changedSubject: 'Адрес для входа в Rehearsly изменён',
    changed: (address) => `Адрес вашего аккаунта Rehearsly теперь ${address}. Входите с ним.\n\nЕсли это были не вы, напишите на ${SUPPORT}.`,
  },
  es: {
    subject: (code) => `${code} es tu código de Rehearsly`,
    verify: (code) => `Introduce ${code} en Rehearsly para confirmar esta dirección de correo. El código vale 15 minutos.\n\nSi no te has registrado en Rehearsly, ignora este correo: sin el código no pasa nada.`,
    reset: (code) => `Introduce ${code} en Rehearsly para crear una contraseña nueva. El código vale 15 minutos.\n\nSi no pediste cambiar la contraseña, ignora este correo: tu contraseña sigue igual.`,
    change: (code) => `Introduce ${code} en Rehearsly para iniciar sesión con esta dirección a partir de ahora. El código vale 15 minutos.\n\nSi no lo pediste tú, ignora este correo.`,
    confirm: (code) => `Introduce ${code} en Rehearsly para confirmar que cambias la dirección con la que inicias sesión. El código vale 15 minutos.\n\nSi no estás cambiando nada, ignora este correo: tu dirección sigue igual.`,
    changedSubject: 'Tu dirección de Rehearsly ha cambiado',
    changed: (address) => `La dirección de correo de tu cuenta de Rehearsly ahora es ${address}. A partir de ahora inicias sesión con ella.\n\nSi no fuiste tú, escríbenos a ${SUPPORT}.`,
  },
  de: {
    subject: (code) => `${code} ist dein Rehearsly-Code`,
    verify: (code) => `Gib ${code} in Rehearsly ein, um diese E-Mail-Adresse zu bestätigen. Der Code gilt 15 Minuten.\n\nWenn du dich nicht bei Rehearsly registriert hast, ignoriere diese E-Mail. Ohne den Code passiert nichts.`,
    reset: (code) => `Gib ${code} in Rehearsly ein, um ein neues Passwort festzulegen. Der Code gilt 15 Minuten.\n\nWenn du kein neues Passwort angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt, wie es ist.`,
    change: (code) => `Gib ${code} in Rehearsly ein, um dich ab jetzt mit dieser Adresse anzumelden. Der Code gilt 15 Minuten.\n\nWenn du das nicht angefordert hast, ignoriere diese E-Mail.`,
    confirm: (code) => `Gib ${code} in Rehearsly ein, um zu bestätigen, dass du deine Anmeldeadresse änderst. Der Code gilt 15 Minuten.\n\nWenn du nichts änderst, ignoriere diese E-Mail. Deine Adresse bleibt, wie sie ist.`,
    changedSubject: 'Deine Rehearsly-Adresse wurde geändert',
    changed: (address) => `Die E-Mail-Adresse deines Rehearsly-Kontos lautet jetzt ${address}. Du meldest dich ab jetzt damit an.\n\nWenn du das nicht warst, schreib an ${SUPPORT}.`,
  },
};

const language = (locale) => (LOCALES.includes(locale) ? locale : 'en');

/** The message carrying a code: purpose is 'verify', 'reset', 'change' or 'confirm'. */
export function codeMessage({ to, code, purpose, locale }) {
  const t = text[language(locale)];
  return { to, subject: t.subject(code), text: t[purpose](code) };
}

/** The notice sent to the old address after a confirmed change. */
export function addressChangedMessage({ to, newAddress, locale }) {
  const t = text[language(locale)];
  return { to, subject: t.changedSubject, text: t.changed(newAddress) };
}
