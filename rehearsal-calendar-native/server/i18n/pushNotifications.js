/**
 * Push notification translations
 * Supported locales: 'ru', 'en', 'es', 'de'. Falls back to 'en' on unknown locale.
 */

// A new or changed rehearsal and a response say when it is, as the reminders
// do: `when` is the rehearsal's start in the reader's zone (reminderText.js).
//
// The title is whatever the director typed, of any gender, so no participle
// agrees with it: in Russian and Spanish it agrees with the word "rehearsal",
// which the title follows in quotes — "Репетиция «Прогон» назначена",
// "Ensayo «Escena del balcón» programado" (T-248).
//
// Nor does anything agree with a person: the server knows no one's gender.
// "присоединился", "откликнулся" were wrong for every woman, "eliminado" and
// "Administrator" for every woman reading them (T-251).
const ruRehearsal = (title) => (title ? `Репетиция «${title}»` : 'Репетиция');
const esRehearsal = (title) => (title ? `Ensayo «${title}»` : 'Ensayo');

const translations = {
  ru: {
    // Put on a rehearsal that already existed, and taken off one (T-233).
    addedToRehearsal: {
      title: 'Вас добавили в репетицию',
      body: ({ projectName, rehearsalTitle, when, location }) =>
        `${projectName}: ${ruRehearsal(rehearsalTitle)} назначена ${when}${location ? `, место: ${location}` : ''}`,
    },
    removedFromRehearsal: {
      title: 'Вас убрали из репетиции',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'}, ${when} — вас убрали из состава`,
    },
    newRehearsal: {
      title: 'Новая репетиция',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${ruRehearsal(rehearsalTitle)} назначена ${when}`,
    },
    rehearsalUpdated: {
      title: 'Изменена репетиция',
      body: ({ projectName, rehearsalTitle, when, movedTo, changed, location }) => {
        const name = rehearsalTitle || 'Репетиция';
        if (changed.datetime) {
          const place = changed.location ? `, ${location ? `место: ${location}` : 'место не указано'}` : '';
          return `${projectName}: ${name} — теперь ${movedTo}${place}`;
        }
        if (changed.location) {
          return `${projectName}: ${name}, ${when} — ${location ? `новое место: ${location}` : 'место больше не указано'}`;
        }
        return `${projectName}: ${name}, ${when} — новое название`;
      },
    },
    rehearsalDeleted: {
      title: 'Отменена репетиция',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${ruRehearsal(rehearsalTitle)} отменена`,
    },
    // Sent to the admins when someone marks a rehearsal seen, in the app's own
    // words for it ("Отметить просмотренным", "Просмотрели"); the yes/no answers
    // it was worded for are gone (T-251).
    memberResponse: {
      title: 'Репетиция просмотрена',
      body: ({ responderName, projectName, rehearsalTitle, when }) =>
        `${responderName} в курсе: «${rehearsalTitle || 'Репетиция'}» (${when}), ${projectName}`,
    },
    memberJoined: {
      title: 'Новый участник',
      body: ({ memberName, projectName }) =>
        `${memberName} теперь в проекте ${projectName}`,
    },
    adminAppointed: {
      title: 'Новый администратор',
      body: ({ memberName, projectName }) =>
        `${memberName} теперь администратор проекта ${projectName}`,
    },
    roleChanged: {
      title: 'Изменение роли',
      // A noun in the nominative after "теперь вы": "Вы теперь
      // администратором" had an instrumental with no verb to govern it (T-251).
      body: ({ admin, projectName }) =>
        `Теперь вы ${admin ? 'администратор' : 'участник'} проекта ${projectName}`,
    },
    memberRemoved: {
      title: 'Удаление из проекта',
      body: ({ projectName }) =>
        `Вас удалили из проекта ${projectName}`,
    },
    projectDeleted: {
      title: 'Проект удалён',
      body: ({ projectName }) =>
        `Проект ${projectName} удалён`,
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
  },
  en: {
    // Put on a rehearsal that already existed, and taken off one (T-233).
    addedToRehearsal: {
      title: 'You were added to a rehearsal',
      body: ({ projectName, rehearsalTitle, when, location }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'} scheduled ${when}${location ? ` at ${location}` : ''}`,
    },
    removedFromRehearsal: {
      title: 'You were taken off a rehearsal',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}, ${when} — you are no longer on it`,
    },
    newRehearsal: {
      title: 'New rehearsal',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'} scheduled ${when}`,
    },
    rehearsalUpdated: {
      title: 'Rehearsal updated',
      body: ({ projectName, rehearsalTitle, when, movedTo, changed, location }) => {
        const name = rehearsalTitle || 'Rehearsal';
        if (changed.datetime) {
          const place = changed.location ? (location ? ` at ${location}` : ', no location') : '';
          return `${projectName}: ${name} — now ${movedTo}${place}`;
        }
        if (changed.location) {
          return `${projectName}: ${name}, ${when} — ${location ? `new location: ${location}` : 'no location now'}`;
        }
        return `${projectName}: ${name}, ${when} — renamed`;
      },
    },
    rehearsalDeleted: {
      title: 'Rehearsal cancelled',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'} cancelled`,
    },
    memberResponse: {
      title: 'Rehearsal seen',
      body: ({ responderName, projectName, rehearsalTitle, when }) =>
        `${responderName} has seen “${rehearsalTitle || 'Rehearsal'}” (${when}) in ${projectName}`,
    },
    memberJoined: {
      title: 'New member',
      body: ({ memberName, projectName }) =>
        `${memberName} joined ${projectName}`,
    },
    adminAppointed: {
      title: 'New administrator',
      body: ({ memberName, projectName }) =>
        `${memberName} is now an administrator of ${projectName}`,
    },
    roleChanged: {
      title: 'Role changed',
      body: ({ admin, projectName }) =>
        `You are now ${admin ? 'an administrator' : 'a member'} of ${projectName}`,
    },
    memberRemoved: {
      title: 'Removed from project',
      body: ({ projectName }) =>
        `You were removed from the project ${projectName}`,
    },
    projectDeleted: {
      title: 'Project deleted',
      body: ({ projectName }) =>
        `The project ${projectName} has been deleted`,
    },
    // The time is the rehearsal's own, in the reader's zone (reminderText.js).
    rehearsal24h: {
      title: ({ when }) => `Rehearsal ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}`,
    },
    rehearsal1h: {
      title: ({ when }) => `Rehearsal soon: ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}`,
    },
    when: {
      today: (time) => `today at ${time}`,
      tomorrow: (time) => `tomorrow at ${time}`,
      on: (date, time) => `on ${date} at ${time}`,
    },
    // Where a rehearsal was moved to: "now tomorrow at 7:00 PM".
    movedTo: {
      today: (time) => `today at ${time}`,
      tomorrow: (time) => `tomorrow at ${time}`,
      on: (date, time) => `on ${date} at ${time}`,
    },
  },
  es: {
    // Put on a rehearsal that already existed, and taken off one (T-233).
    addedToRehearsal: {
      title: 'Te han añadido a un ensayo',
      body: ({ projectName, rehearsalTitle, when, location }) =>
        // "programado para": set for that day, not set on it (T-248).
        `${projectName}: ${esRehearsal(rehearsalTitle)} programado para ${when}${location ? ` en ${location}` : ''}`,
    },
    removedFromRehearsal: {
      title: 'Te han quitado de un ensayo',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}, ${when} — ya no estás en él`,
    },
    newRehearsal: {
      title: 'Nuevo ensayo',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${esRehearsal(rehearsalTitle)} programado para ${when}`,
    },
    rehearsalUpdated: {
      title: 'Ensayo actualizado',
      // "pasa a hoy", "pasa al mar, 6 oct": movedTo carries its own "a".
      body: ({ projectName, rehearsalTitle, when, movedTo, changed, location }) => {
        const name = rehearsalTitle || 'Ensayo';
        if (changed.datetime) {
          const place = changed.location ? (location ? ` en ${location}` : ', sin lugar asignado') : '';
          return `${projectName}: ${name}, pasa ${movedTo}${place}`;
        }
        if (changed.location) {
          return `${projectName}: ${name}, ${when} — ${location ? `nuevo lugar: ${location}` : 'ya sin lugar asignado'}`;
        }
        return `${projectName}: ${name}, ${when} — nuevo nombre`;
      },
    },
    rehearsalDeleted: {
      title: 'Ensayo cancelado',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${esRehearsal(rehearsalTitle)} cancelado`,
    },
    memberResponse: {
      title: 'Ensayo visto',
      body: ({ responderName, projectName, rehearsalTitle, when }) =>
        `${responderName} ha visto «${rehearsalTitle || 'Ensayo'}» (${when}) en ${projectName}`,
    },
    memberJoined: {
      title: 'Nuevo miembro',
      body: ({ memberName, projectName }) =>
        `${memberName} se unió a ${projectName}`,
    },
    adminAppointed: {
      title: 'Nueva administración',
      body: ({ memberName, projectName }) =>
        `${memberName} ahora administra ${projectName}`,
    },
    roleChanged: {
      title: 'Cambio de rol',
      // A verb, as adminAppointed says it: "administrador" agreed with a man
      // reading it, and "miembro" with anyone (T-251).
      body: ({ admin, projectName }) =>
        (admin ? `Ahora administras ${projectName}` : `Ahora eres miembro de ${projectName}`),
    },
    memberRemoved: {
      // No participle: "eliminado" agreed with a man reading it (T-251).
      title: 'Ya no estás en el proyecto',
      body: ({ projectName }) =>
        `Ya no formas parte del proyecto ${projectName}`,
    },
    projectDeleted: {
      title: 'Proyecto eliminado',
      body: ({ projectName }) =>
        `El proyecto ${projectName} ha sido eliminado`,
    },
    // The time is the rehearsal's own, in the reader's zone (reminderText.js).
    rehearsal24h: {
      title: ({ when }) => `Ensayo ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}`,
    },
    rehearsal1h: {
      title: ({ when }) => `Ensayo pronto: ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}`,
    },
    when: {
      today: (time) => `hoy a las ${time}`,
      tomorrow: (time) => `mañana a las ${time}`,
      on: (date, time) => `el ${date} a las ${time}`,
    },
    // Where a rehearsal was moved to: "pasa a mañana a las 19:00", "pasa al
    // mar, 6 oct a las 19:00" — "a el" contracts.
    movedTo: {
      today: (time) => `a hoy a las ${time}`,
      tomorrow: (time) => `a mañana a las ${time}`,
      on: (date, time) => `al ${date} a las ${time}`,
    },
  },
  de: {
    // Put on a rehearsal that already existed, and taken off one (T-233).
    addedToRehearsal: {
      title: 'Du wurdest zu einer Probe hinzugefügt',
      body: ({ projectName, rehearsalTitle, when, location }) =>
        // The participle goes last (T-248).
        `${projectName}: ${rehearsalTitle || 'Probe'} ${when} angesetzt${location ? `, Ort: ${location}` : ''}`,
    },
    removedFromRehearsal: {
      title: 'Du wurdest von einer Probe genommen',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'}, ${when} – du bist nicht mehr dabei`,
    },
    newRehearsal: {
      title: 'Neue Probe',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'} ${when} angesetzt`,
    },
    rehearsalUpdated: {
      title: 'Probe geändert',
      // "verlegt auf heute, 19:00": movedTo carries its own "auf".
      body: ({ projectName, rehearsalTitle, when, movedTo, changed, location }) => {
        const name = rehearsalTitle || 'Probe';
        if (changed.datetime) {
          const place = changed.location ? (location ? `, Ort: ${location}` : ', ohne Ort') : '';
          return `${projectName}: ${name} – verlegt ${movedTo}${place}`;
        }
        if (changed.location) {
          return `${projectName}: ${name}, ${when} – ${location ? `neuer Ort: ${location}` : 'kein Ort mehr'}`;
        }
        return `${projectName}: ${name}, ${when} – neuer Titel`;
      },
    },
    rehearsalDeleted: {
      title: 'Probe abgesagt',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'} abgesagt`,
    },
    memberResponse: {
      title: 'Probe gesehen',
      body: ({ responderName, projectName, rehearsalTitle, when }) =>
        `${responderName} hat „${rehearsalTitle || 'Probe'}“ (${when}) in ${projectName} gesehen`,
    },
    memberJoined: {
      title: 'Neues Mitglied',
      body: ({ memberName, projectName }) =>
        `${memberName} ist ${projectName} beigetreten`,
    },
    adminAppointed: {
      title: 'Neue Verwaltung',
      body: ({ memberName, projectName }) =>
        `${memberName} verwaltet jetzt ${projectName}`,
    },
    roleChanged: {
      title: 'Rolle geändert',
      // A verb, as adminAppointed says it: "Administrator" is a man's (T-251).
      body: ({ admin, projectName }) =>
        (admin ? `Du verwaltest jetzt ${projectName}` : `Du bist jetzt Mitglied in ${projectName}`),
    },
    memberRemoved: {
      title: 'Aus dem Projekt entfernt',
      body: ({ projectName }) =>
        `Du wurdest aus dem Projekt ${projectName} entfernt`,
    },
    projectDeleted: {
      title: 'Projekt gelöscht',
      body: ({ projectName }) =>
        `Das Projekt ${projectName} wurde gelöscht`,
    },
    // The time is the rehearsal's own, in the reader's zone (reminderText.js).
    rehearsal24h: {
      title: ({ when }) => `Probe ${when}`,
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'}`,
    },
    rehearsal1h: {
      title: ({ when }) => `Probe gleich: ${when}`,
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
