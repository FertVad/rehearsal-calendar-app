/**
 * Push notification translations
 * Supported locales: 'ru', 'en', 'es', 'de'. Falls back to 'en' on unknown locale.
 */

const translations = {
  ru: {
    newRehearsal: {
      title: 'Новая репетиция',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'} назначена`,
    },
    rehearsalUpdated: {
      title: 'Изменена репетиция',
      body: ({ projectName, rehearsalTitle, changes }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'} — ${changes}`,
    },
    rehearsalDeleted: {
      title: 'Отменена репетиция',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'} отменена`,
    },
    memberResponse: {
      title: 'Новый отклик',
      body: ({ responderName, projectName }) =>
        `${responderName} откликнулся на репетицию в проекте ${projectName}`,
    },
    projectInvite: {
      title: 'Приглашение в проект',
      body: ({ inviterName, projectName }) =>
        `${inviterName} пригласил вас в проект ${projectName}`,
    },
    roleChanged: {
      title: 'Изменение роли',
      body: ({ roleText, projectName }) =>
        `Вы теперь ${roleText} проекта ${projectName}`,
      adminRole: 'администратором',
      memberRole: 'участником',
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
    rehearsal24h: {
      title: 'Репетиция завтра',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'}`,
    },
    rehearsal1h: {
      title: 'Репетиция через 1 час',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Репетиция'}`,
    },
    changes: {
      datetime: 'дата/время',
      location: 'место',
      title: 'название',
      default: 'детали',
    },
  },
  en: {
    newRehearsal: {
      title: 'New rehearsal',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'} scheduled`,
    },
    rehearsalUpdated: {
      title: 'Rehearsal updated',
      body: ({ projectName, rehearsalTitle, changes }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'} — ${changes}`,
    },
    rehearsalDeleted: {
      title: 'Rehearsal cancelled',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'} cancelled`,
    },
    memberResponse: {
      title: 'New response',
      body: ({ responderName, projectName }) =>
        `${responderName} responded to a rehearsal in ${projectName}`,
    },
    projectInvite: {
      title: 'Project invitation',
      body: ({ inviterName, projectName }) =>
        `${inviterName} invited you to the project ${projectName}`,
    },
    roleChanged: {
      title: 'Role changed',
      body: ({ roleText, projectName }) =>
        `You are now ${roleText} in ${projectName}`,
      adminRole: 'an administrator',
      memberRole: 'a member',
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
    rehearsal24h: {
      title: 'Rehearsal tomorrow',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}`,
    },
    rehearsal1h: {
      title: 'Rehearsal in 1 hour',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Rehearsal'}`,
    },
    changes: {
      datetime: 'date/time',
      location: 'location',
      title: 'title',
      default: 'details',
    },
  },
  es: {
    newRehearsal: {
      title: 'Nuevo ensayo',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'} programado`,
    },
    rehearsalUpdated: {
      title: 'Ensayo actualizado',
      body: ({ projectName, rehearsalTitle, changes }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'} — ${changes}`,
    },
    rehearsalDeleted: {
      title: 'Ensayo cancelado',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'} cancelado`,
    },
    memberResponse: {
      title: 'Nueva respuesta',
      body: ({ responderName, projectName }) =>
        `${responderName} ha respondido a un ensayo en ${projectName}`,
    },
    projectInvite: {
      title: 'Invitación al proyecto',
      body: ({ inviterName, projectName }) =>
        `${inviterName} te invitó al proyecto ${projectName}`,
    },
    roleChanged: {
      title: 'Cambio de rol',
      body: ({ roleText, projectName }) =>
        `Ahora eres ${roleText} en ${projectName}`,
      adminRole: 'administrador',
      memberRole: 'miembro',
    },
    memberRemoved: {
      title: 'Eliminado del proyecto',
      body: ({ projectName }) =>
        `Has sido eliminado del proyecto ${projectName}`,
    },
    projectDeleted: {
      title: 'Proyecto eliminado',
      body: ({ projectName }) =>
        `El proyecto ${projectName} ha sido eliminado`,
    },
    rehearsal24h: {
      title: 'Ensayo mañana',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}`,
    },
    rehearsal1h: {
      title: 'Ensayo en 1 hora',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Ensayo'}`,
    },
    changes: {
      datetime: 'fecha/hora',
      location: 'lugar',
      title: 'título',
      default: 'detalles',
    },
  },
  de: {
    newRehearsal: {
      title: 'Neue Probe',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'} angesetzt`,
    },
    rehearsalUpdated: {
      title: 'Probe geändert',
      body: ({ projectName, rehearsalTitle, changes }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'} — ${changes}`,
    },
    rehearsalDeleted: {
      title: 'Probe abgesagt',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'} abgesagt`,
    },
    memberResponse: {
      title: 'Neue Antwort',
      body: ({ responderName, projectName }) =>
        `${responderName} hat auf eine Probe in ${projectName} reagiert`,
    },
    projectInvite: {
      title: 'Projekteinladung',
      body: ({ inviterName, projectName }) =>
        `${inviterName} hat dich zum Projekt ${projectName} eingeladen`,
    },
    roleChanged: {
      title: 'Rolle geändert',
      body: ({ roleText, projectName }) =>
        `Du bist jetzt ${roleText} in ${projectName}`,
      adminRole: 'Administrator',
      memberRole: 'Mitglied',
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
    rehearsal24h: {
      title: 'Probe morgen',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'}`,
    },
    rehearsal1h: {
      title: 'Probe in 1 Stunde',
      body: ({ projectName, rehearsalTitle }) =>
        `${projectName}: ${rehearsalTitle || 'Probe'}`,
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
