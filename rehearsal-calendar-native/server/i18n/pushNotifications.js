/**
 * Push notification translations
 * Supported locales: 'ru', 'en'. Falls back to 'en' on unknown locale.
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
    paymentFailed: {
      title: 'Ошибка оплаты',
      body: () => 'Не удалось списать оплату подписки. Обновите способ оплаты.',
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
    paymentFailed: {
      title: 'Payment failed',
      body: () => 'Your subscription payment could not be processed. Please update your payment method.',
    },
    changes: {
      datetime: 'date/time',
      location: 'location',
      title: 'title',
      default: 'details',
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
