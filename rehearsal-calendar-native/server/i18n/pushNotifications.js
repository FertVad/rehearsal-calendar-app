import { quoteName } from '../../shared/quoteName.cjs';

/**
 * Push notification translations
 * Supported locales: 'ru', 'en', 'es', 'de'. Falls back to 'en' on unknown locale.
 */

// A new, changed or cancelled rehearsal and a response say when it is, as the
// reminders do: `when` is the rehearsal's start in the reader's zone
// (reminderText.js). A cancelled one said nothing of when, and of two
// untitled rehearsals the reader could not tell which had gone (T-256).
//
// The title is whatever the director typed, of any gender, so no participle
// agrees with it: in Russian and Spanish it agrees with the word "rehearsal",
// which the title follows in quotes — "Репетиция «Прогон» назначена",
// "Ensayo «Escena del balcón» programado" (T-248). German puts the word first
// too, so the title does not run into the date: "Probe „Szene am Fenster“ am
// Di., 6. Okt. um 19:00 angesetzt" (T-256).
//
// Nor does anything agree with a person: the server knows no one's gender.
// "присоединился", "откликнулся" were wrong for every woman, "eliminado" and
// "Administrator" for every woman reading them (T-251).
//
// A project's name follows the word "project" in quotes in Russian and
// German, and the German case goes on "Projekt": "ist Der Kirschgarten
// beigetreten" wanted a dative the name cannot take (T-256). Spanish too:
// "se unió a Bodas de sangre 2026" ran into the sentence (T-261).
//
// `until` is the end, already worded for the reader: "22:00", "1:00
// следующего дня", "полуночи" (reminderText.js, untilTime).
//
// English titles are in Title Case, as Apple's HIG asks of a notification's
// title; the text is in sentence case (T-256).
// A name in quotes goes through quoteName: quotes it was typed with are not
// doubled, those inside it are the language's second level — «Прогон „Чайки“»,
// not «Прогон «Чайки»» (T-261).
const ru = (name) => quoteName(name, 'ru');
const en = (name) => quoteName(name, 'en');
const es = (name) => quoteName(name, 'es');
const de = (name) => quoteName(name, 'de');
const ruRehearsal = (title) => (title ? `Репетиция ${ru(title)}` : 'Репетиция');
const esRehearsal = (title) => (title ? `Ensayo ${es(title)}` : 'Ensayo');
const deRehearsal = (title) => (title ? `Probe ${de(title)}` : 'Probe');
// "a las 19:00", "hasta las 22:00" — but one o'clock is singular: "a la 1:00",
// "hasta la 1:30" (T-250).
const esLas = (time) => (/^1\D/.test(time) ? `la ${time}` : `las ${time}`);

const translations = {
  ru: {
    // Put on a rehearsal that already existed, and taken off one (T-233).
    // One is called to a rehearsal and taken off it: "позвали на", "сняли с"
    // (T-256).
    addedToRehearsal: {
      title: 'Вас позвали на репетицию',
      body: ({ projectName, rehearsalTitle, when, location }) =>
        `${projectName}: ${ruRehearsal(rehearsalTitle)} назначена на ${when}${location ? `, место: ${location}` : ''}`,
    },
    removedFromRehearsal: {
      title: 'Вас сняли с репетиции',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'}, ${when} — вас больше нет в составе`,
    },
    newRehearsal: {
      title: 'Новая репетиция',
      // "назначена на завтра": without "на", "назначена сегодня" read as
      // "was scheduled today" (T-256).
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${ruRehearsal(rehearsalTitle)} назначена на ${when}`,
    },
    rehearsalUpdated: {
      title: 'Изменена репетиция',
      body: ({ projectName, rehearsalTitle, when, movedTo, movedFrom, until, changed, location }) => {
        const name = rehearsalTitle || 'Репетиция';
        if (changed.datetime) {
          const place = changed.location ? `, ${location ? `место: ${location}` : 'место не указано'}` : '';
          // A span is "с … до …", not "в 19:00 до 22:00" (T-256).
          return `${projectName}: ${name} — теперь ${until ? `${movedFrom} до ${until}` : movedTo}${place}`;
        }
        const what = [
          until && `теперь до ${until}`,
          changed.location && (location ? `новое место: ${location}` : 'место больше не указано'),
        ].filter(Boolean);
        // Renamed to nothing is no new name (T-256).
        const renamed = rehearsalTitle ? 'новое название' : 'теперь без названия';
        return `${projectName}: ${name}, ${when} — ${what.length ? what.join(', ') : renamed}`;
      },
    },
    rehearsalDeleted: {
      title: 'Отменена репетиция',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${ruRehearsal(rehearsalTitle)} на ${when} отменена`,
    },
    // Sent to the admins when someone marks a rehearsal seen, in the app's own
    // words for it ("Отметить просмотренным", "Просмотрели"); the yes/no answers
    // it was worded for are gone (T-251). In the order of the other notices,
    // and the word "Репетиция" in no quotes, as if it were a title (T-256).
    memberResponse: {
      title: 'Репетиция просмотрена',
      body: ({ responderName, projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'}, ${when} — ${responderName} в курсе`,
    },
    memberJoined: {
      title: 'Новый участник',
      body: ({ memberName, projectName }) =>
        `${memberName} теперь в проекте ${ru(projectName)}`,
    },
    adminAppointed: {
      title: 'Новый администратор',
      body: ({ memberName, projectName }) =>
        `${memberName} теперь администратор проекта ${ru(projectName)}`,
    },
    // Told to whoever runs the project when somebody is no longer in it (T-271).
    // Nothing agrees with the person: "вышла", "удалён" would guess a gender;
    // "вышел" and "удалён" in the titles agree with the word "участник". The
    // body of a removal does not repeat its title (T-280).
    memberLeft: {
      title: 'Участник вышел из проекта',
      body: ({ memberName, projectName }) =>
        `${memberName} больше не в проекте ${ru(projectName)}`,
    },
    memberWasRemoved: {
      title: 'Участник удалён',
      body: ({ memberName, projectName }) =>
        `${memberName} больше не в проекте ${ru(projectName)}`,
    },
    roleChanged: {
      title: 'Изменение роли',
      // A noun in the nominative after "теперь вы": "Вы теперь
      // администратором" had an instrumental with no verb to govern it (T-251).
      // Rights taken away say so: "теперь вы участник" read as "you were let
      // into the project" (T-256).
      body: ({ admin, projectName }) =>
        (admin ? `Теперь вы администратор проекта ${ru(projectName)}` : `Вы больше не администратор проекта ${ru(projectName)}`),
    },
    memberRemoved: {
      title: 'Удаление из проекта',
      body: ({ projectName }) =>
        `Вас удалили из проекта ${ru(projectName)}`,
    },
    projectDeleted: {
      title: 'Проект удалён',
      body: ({ projectName }) =>
        `Проект ${ru(projectName)} удалён`,
    },
    // The time is the rehearsal's own, in the reader's zone (reminderText.js).
    rehearsal24h: {
      title: ({ when }) => `Репетиция ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'}`,
    },
    rehearsal1h: {
      title: ({ when }) => `Скоро репетиция: ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'}`,
    },
    when: {
      today: (time) => `сегодня в ${time}`,
      tomorrow: (time) => `завтра в ${time}`,
      on: (date, time) => `${date} в ${time}`,
    },
    // Where a rehearsal was moved to: "теперь завтра в 19:00".
    movedTo: {
      today: (time) => `сегодня в ${time}`,
      tomorrow: (time) => `завтра в ${time}`,
      on: (date, time) => `${date} в ${time}`,
    },
    // …and with its end: "теперь завтра с 19:00 до 22:00" (T-256).
    movedFrom: {
      today: (time) => `сегодня с ${time}`,
      tomorrow: (time) => `завтра с ${time}`,
      on: (date, time) => `${date} с ${time}`,
    },
    // After "до" (T-256).
    until: {
      at: (time) => time,
      nextDay: (time) => `${time} следующего дня`,
      midnight: (utc) => (utc ? 'полуночи по UTC' : 'полуночи'),
    },
  },
  en: {
    // Put on a rehearsal that already existed, and taken off one (T-233).
    addedToRehearsal: {
      title: 'You Were Added to a Rehearsal',
      body: ({ projectName, rehearsalTitle, when, location }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'} scheduled ${when}${location ? ` at ${location}` : ''}`,
    },
    removedFromRehearsal: {
      title: 'You Were Taken Off a Rehearsal',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}, ${when} — you are no longer on it`,
    },
    newRehearsal: {
      title: 'New Rehearsal',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'} scheduled ${when}`,
    },
    rehearsalUpdated: {
      title: 'Rehearsal Updated',
      // "moved to tomorrow at 7:00 PM": "now today at 8:00 PM" put two words
      // of time side by side (T-256).
      body: ({ projectName, rehearsalTitle, when, movedTo, until, changed, location }) => {
        const name = rehearsalTitle || 'Rehearsal';
        const end = until ? ` until ${until}` : '';
        if (changed.datetime) {
          const place = changed.location ? (location ? ` at ${location}` : ', location removed') : '';
          return `${projectName}: ${name} — moved to ${movedTo}${end}${place}`;
        }
        const what = [
          until && `now until ${until}`,
          changed.location && (location ? `new location: ${location}` : 'location removed'),
        ].filter(Boolean);
        const renamed = rehearsalTitle ? 'renamed' : 'title removed';
        return `${projectName}: ${name}, ${when} — ${what.length ? what.join(', ') : renamed}`;
      },
    },
    rehearsalDeleted: {
      title: 'Rehearsal Canceled',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}, ${when} — canceled`,
    },
    // A generic word in quotes read as a title: "has seen “Rehearsal”" (T-256).
    memberResponse: {
      title: 'Rehearsal Seen',
      body: ({ responderName, projectName, rehearsalTitle, when }) =>
        `${responderName} has seen ${rehearsalTitle ? en(rehearsalTitle) : 'the rehearsal'} (${when}) in ${projectName}`,
    },
    memberJoined: {
      title: 'New Member',
      body: ({ memberName, projectName }) =>
        `${memberName} joined ${projectName}`,
    },
    adminAppointed: {
      title: 'New Administrator',
      body: ({ memberName, projectName }) =>
        `${memberName} is now an administrator of ${projectName}`,
    },
    // Told to whoever runs the project when somebody is no longer in it (T-271).
    memberLeft: {
      title: 'Member Left',
      body: ({ memberName, projectName }) =>
        `${memberName} left ${projectName}`,
    },
    memberWasRemoved: {
      title: 'Member Removed',
      body: ({ memberName, projectName }) =>
        `${memberName} was removed from ${projectName}`,
    },
    roleChanged: {
      title: 'Role Changed',
      // Rights taken away say so: "You are now a member" read as being let into
      // the project (T-261).
      body: ({ admin, projectName }) =>
        (admin ? `You are now an administrator of ${projectName}` : `You are no longer an administrator of ${projectName}`),
    },
    memberRemoved: {
      title: 'Removed from Project',
      body: ({ projectName }) =>
        `You were removed from the project ${projectName}`,
    },
    projectDeleted: {
      title: 'Project Deleted',
      body: ({ projectName }) =>
        `The project ${projectName} has been deleted`,
    },
    // The time is the rehearsal's own, in the reader's zone (reminderText.js),
    // capitalised as a title: "Rehearsal Tomorrow at 7:00 PM". A dash, not a
    // colon, after "Soon": Title Case would make "on" after a colon "On".
    rehearsal24h: {
      title: ({ when }) => `Rehearsal ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}`,
    },
    rehearsal1h: {
      title: ({ when }) => `Rehearsal Soon — ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}`,
    },
    when: {
      today: (time) => `today at ${time}`,
      tomorrow: (time) => `tomorrow at ${time}`,
      on: (date, time) => `on ${date} at ${time}`,
    },
    // In a title (T-256).
    titleWhen: {
      today: (time) => `Today at ${time}`,
      tomorrow: (time) => `Tomorrow at ${time}`,
      on: (date, time) => `on ${date} at ${time}`,
    },
    // Where a rehearsal was moved to: "moved to tomorrow at 7:00 PM".
    movedTo: {
      today: (time) => `today at ${time}`,
      tomorrow: (time) => `tomorrow at ${time}`,
      on: (date, time) => `${date} at ${time}`,
    },
    // After "until" (T-256). Midnight, not "12:00 AM", which reads as noon.
    until: {
      at: (time) => time,
      nextDay: (time) => `${time} the next day`,
      midnight: (utc) => (utc ? 'midnight UTC' : 'midnight'),
    },
  },
  es: {
    // Put on a rehearsal that already existed, and taken off one (T-233).
    addedToRehearsal: {
      title: 'Te han añadido a un ensayo',
      // "programado para": set for that day, not set on it (T-248). The place
      // after "Lugar:": "en Teatro Real" wants an article no word of the
      // user's can be given (T-256).
      body: ({ projectName, rehearsalTitle, when, location }) =>
        `${projectName}: ${esRehearsal(rehearsalTitle)} programado para ${when}${location ? `. Lugar: ${location}` : ''}`,
    },
    removedFromRehearsal: {
      title: 'Te han quitado de un ensayo',
      // "en él" agreed with a title as if it were masculine (T-256).
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}, ${when} — ya no estás en este ensayo`,
    },
    newRehearsal: {
      title: 'Nuevo ensayo',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${esRehearsal(rehearsalTitle)} programado para ${when}`,
    },
    rehearsalUpdated: {
      title: 'Ensayo actualizado',
      // "pasa a hoy", "pasa al martes 6 de octubre": movedTo carries its own
      // "a". Only the end changed: "ahora termina a las 22:30" (T-256).
      body: ({ projectName, rehearsalTitle, when, movedTo, until, changed, location }) => {
        const name = rehearsalTitle || 'Ensayo';
        const end = until ? `, hasta ${until}` : '';
        if (changed.datetime) {
          const place = changed.location ? (location ? `. Lugar: ${location}` : ', sin lugar asignado') : '';
          return `${projectName}: ${name}, pasa ${movedTo}${end}${place}`;
        }
        const what = [
          until && `ahora termina a ${until}`,
          changed.location && (location ? `nuevo lugar: ${location}` : 'ya sin lugar asignado'),
        ].filter(Boolean);
        // "título", the form's own word (T-256).
        const renamed = rehearsalTitle ? 'nuevo título' : 'ya sin título';
        return `${projectName}: ${name}, ${when} — ${what.length ? what.join(', ') : renamed}`;
      },
    },
    rehearsalDeleted: {
      title: 'Ensayo cancelado',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: Cancelado el ensayo${rehearsalTitle ? ` ${es(rehearsalTitle)}` : ''} previsto para ${when}`,
    },
    memberResponse: {
      title: 'Ensayo visto',
      body: ({ responderName, projectName, rehearsalTitle, when }) =>
        `${responderName} ha visto ${rehearsalTitle ? es(rehearsalTitle) : 'el ensayo'} (${when}) en ${projectName}`,
    },
    memberJoined: {
      title: 'Nuevo miembro',
      body: ({ memberName, projectName }) =>
        `${memberName} se unió al proyecto ${es(projectName)}`,
    },
    adminAppointed: {
      // "Nueva administración" read as "a new government" (T-256).
      title: 'Permisos de administrador',
      body: ({ memberName, projectName }) =>
        `${memberName} ahora administra el proyecto ${es(projectName)}`,
    },
    // Told to whoever runs the project when somebody is no longer in it (T-271).
    // No participle agrees with the person: "dado de baja" would guess a
    // gender, so the removal is impersonal, as "Te han quitado de un ensayo".
    memberLeft: {
      title: 'Salida del proyecto',
      body: ({ memberName, projectName }) =>
        `${memberName} dejó el proyecto ${es(projectName)}`,
    },
    memberWasRemoved: {
      title: 'Miembro eliminado',
      body: ({ memberName, projectName }) =>
        `Han eliminado a ${memberName} del proyecto ${es(projectName)}`,
    },
    roleChanged: {
      title: 'Cambio de rol',
      // A verb, as adminAppointed says it: "administrador" agreed with a man
      // reading it, and "miembro" with anyone (T-251).
      body: ({ admin, projectName }) =>
        (admin ? `Ahora administras el proyecto ${es(projectName)}` : `Ya no administras el proyecto ${es(projectName)}`),
    },
    memberRemoved: {
      // No participle: "eliminado" agreed with a man reading it (T-251).
      title: 'Ya no estás en el proyecto',
      body: ({ projectName }) =>
        `Ya no formas parte del proyecto ${es(projectName)}`,
    },
    projectDeleted: {
      title: 'Proyecto eliminado',
      body: ({ projectName }) =>
        `El proyecto ${es(projectName)} ha sido eliminado`,
    },
    // The time is the rehearsal's own, in the reader's zone (reminderText.js).
    rehearsal24h: {
      title: ({ when }) => `Ensayo ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}`,
    },
    rehearsal1h: {
      title: ({ when }) => `Ensayo en breve: ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}`,
    },
    when: {
      today: (time) => `hoy a ${esLas(time)}`,
      tomorrow: (time) => `mañana a ${esLas(time)}`,
      on: (date, time) => `el ${date} a ${esLas(time)}`,
    },
    // Where a rehearsal was moved to: "pasa a mañana a las 19:00", "pasa al
    // martes 6 de octubre a las 19:00" — "a el" contracts.
    movedTo: {
      today: (time) => `a hoy a ${esLas(time)}`,
      tomorrow: (time) => `a mañana a ${esLas(time)}`,
      on: (date, time) => `al ${date} a ${esLas(time)}`,
    },
    // After "hasta", "termina a" (T-256).
    until: {
      at: (time) => esLas(time),
      nextDay: (time) => `${esLas(time)} del día siguiente`,
      midnight: (utc) => (utc ? 'la medianoche UTC' : 'la medianoche'),
    },
  },
  de: {
    // Put on a rehearsal that already existed, and taken off one (T-233).
    // One is "eingeteilt" for a rehearsal; "von einer Probe genommen" is no
    // German (T-256).
    addedToRehearsal: {
      title: 'Du wurdest für eine Probe eingeteilt',
      body: ({ projectName, rehearsalTitle, when, location }) =>
        // The participle goes last (T-248).
        `${projectName}: ${deRehearsal(rehearsalTitle)} ${when} angesetzt${location ? `, Ort: ${location}` : ''}`,
    },
    removedFromRehearsal: {
      // One line on the lock screen: "eingeteilt" was cut off (T-261).
      title: 'Nicht mehr eingeteilt',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${deRehearsal(rehearsalTitle)}, ${when} – du bist nicht mehr dabei`,
    },
    newRehearsal: {
      title: 'Neue Probe',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${deRehearsal(rehearsalTitle)} ${when} angesetzt`,
    },
    rehearsalUpdated: {
      title: 'Probe geändert',
      // "verlegt auf heute, 19:00": movedTo carries its own "auf".
      body: ({ projectName, rehearsalTitle, when, movedTo, until, changed, location }) => {
        const name = deRehearsal(rehearsalTitle);
        const end = until ? ` bis ${until}` : '';
        if (changed.datetime) {
          const place = changed.location ? (location ? `, Ort: ${location}` : ', ohne Ort') : '';
          return `${projectName}: ${name} – verlegt ${movedTo}${end}${place}`;
        }
        const what = [
          until && `jetzt bis ${until}`,
          changed.location && (location ? `neuer Ort: ${location}` : 'kein Ort mehr'),
        ].filter(Boolean);
        const renamed = rehearsalTitle ? 'neuer Titel' : 'Titel entfernt';
        return `${projectName}: ${name}, ${when} – ${what.length ? what.join(', ') : renamed}`;
      },
    },
    rehearsalDeleted: {
      title: 'Probe abgesagt',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${deRehearsal(rehearsalTitle)} ${when} abgesagt`,
    },
    // "hat „Durchlauf“ gesehen" said she watched it, as an audience does; the
    // app's word is "als gesehen markiert" (T-256).
    memberResponse: {
      title: 'Probe gesehen',
      body: ({ responderName, projectName, rehearsalTitle, when }) =>
        `${projectName}: ${responderName} hat ${rehearsalTitle ? `die Probe ${de(rehearsalTitle)}` : 'die Probe'} (${when}) als gesehen markiert`,
    },
    memberJoined: {
      title: 'Neues Mitglied',
      body: ({ memberName, projectName }) =>
        `${memberName} ist dem Projekt ${de(projectName)} beigetreten`,
    },
    adminAppointed: {
      // "Neue Verwaltung" read as the management of a building (T-256).
      title: 'Adminrechte vergeben',
      body: ({ memberName, projectName }) =>
        `${memberName} verwaltet jetzt das Projekt ${de(projectName)}`,
    },
    // Told to whoever runs the project when somebody is no longer in it (T-271).
    memberLeft: {
      title: 'Mitglied ausgetreten',
      body: ({ memberName, projectName }) =>
        `${memberName} ist aus dem Projekt ${de(projectName)} ausgetreten`,
    },
    memberWasRemoved: {
      title: 'Mitglied entfernt',
      body: ({ memberName, projectName }) =>
        `${memberName} wurde aus dem Projekt ${de(projectName)} entfernt`,
    },
    roleChanged: {
      title: 'Rolle geändert',
      // A verb, as adminAppointed says it: "Administrator" is a man's (T-251).
      body: ({ admin, projectName }) =>
        (admin ? `Du verwaltest jetzt das Projekt ${de(projectName)}` : `Du verwaltest das Projekt ${de(projectName)} nicht mehr`),
    },
    memberRemoved: {
      title: 'Aus dem Projekt entfernt',
      body: ({ projectName }) =>
        `Du wurdest aus dem Projekt ${de(projectName)} entfernt`,
    },
    projectDeleted: {
      title: 'Projekt gelöscht',
      body: ({ projectName }) =>
        `Das Projekt ${de(projectName)} wurde gelöscht`,
    },
    // The time is the rehearsal's own, in the reader's zone (reminderText.js).
    rehearsal24h: {
      title: ({ when }) => `Probe ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'}`,
    },
    rehearsal1h: {
      // "Probe gleich" was a fragment, and "gleich" is a minute, not an hour.
      title: ({ when }) => `Probe beginnt bald: ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'}`,
    },
    when: {
      today: (time) => `heute um ${time}`,
      tomorrow: (time) => `morgen um ${time}`,
      on: (date, time) => `am ${date} um ${time}`,
    },
    // Where a rehearsal was moved to: "verlegt auf morgen, 19:00", "verlegt
    // auf Di., 6. Okt., 19:00" — "auf am" is no German.
    movedTo: {
      today: (time) => `auf heute, ${time}`,
      tomorrow: (time) => `auf morgen, ${time}`,
      on: (date, time) => `auf ${date}, ${time}`,
    },
    // After "bis" (T-256).
    until: {
      at: (time) => time,
      nextDay: (time) => `${time} am Folgetag`,
      midnight: (utc) => (utc ? 'Mitternacht UTC' : 'Mitternacht'),
    },
  },
};

/**
 * Get translation block for a given locale and key.
 * Falls back to 'en' on unknown locale.
 */
export function t(locale, key) {
  const validLocale = translations[locale] ? locale : 'en';
  return translations[validLocale][key];
}
