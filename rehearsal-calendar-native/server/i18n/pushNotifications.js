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
      body: ({ projectName, rehearsalTitle, when, changes }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'}, ${when} — ${changes}`,
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
        `Вы были удалены из проекта ${projectName}`,
    },
    projectDeleted: {
      title: 'Проект удалён',
      body: ({ projectName }) =>
        `Проект ${projectName} был удалён`,
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
    changes: {
      datetime: 'дата/время',
      location: 'место',
      title: 'название',
      default: 'детали',
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
      body: ({ projectName, rehearsalTitle, when, changes }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}, ${when} — ${changes}`,
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
        `You are now ${admin ? 'an administrator' : 'a member'} in ${projectName}`,
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
    changes: {
      datetime: 'date/time',
      location: 'location',
      title: 'title',
      default: 'details',
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
      body: ({ projectName, rehearsalTitle, when, changes }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}, ${when} — ${changes}`,
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
      title: 'Nuevo integrante',
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
    changes: {
      datetime: 'fecha/hora',
      location: 'lugar',
      title: 'título',
      default: 'detalles',
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
        `${projectName}: ${rehearsalTitle || 'Probe'}, ${when} — du bist nicht mehr dabei`,
    },
    newRehearsal: {
      title: 'Neue Probe',
      body: ({ projectName, rehearsalTitle, when }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'} ${when} angesetzt`,
    },
    rehearsalUpdated: {
      title: 'Probe geändert',
      body: ({ projectName, rehearsalTitle, when, changes }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'}, ${when} — ${changes}`,
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
    changes: {
      datetime: 'Datum/Zeit',
      location: 'Ort',
      title: 'Titel',
      default: 'Details',
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
