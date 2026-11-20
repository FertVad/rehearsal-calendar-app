/**
 * What the server's refusals are called on screen (T-281). The server answers
 * with a machine `code`; its English sentence is for logs and the developer,
 * and the app never shows it. requestErrorMessage turns the code into one of
 * these — or into a text the app already had for it (an invite, a rehearsal,
 * a project not found). A refusal with no code here gets the screen's own
 * fallback, which is in the person's language too.
 */
export interface ErrorsTranslations {
  /** NOT_PROJECT_MEMBER: removed from the project, or the project was deleted. */
  notProjectMember: string;
  /** MEMBER_NOT_FOUND: the person acted on has already left or been removed. */
  memberNotFound: string;
  /** ADMIN_ONLY: the person is no longer an administrator of the project. */
  adminOnly: string;
  /** OWNER_ONLY: only the project's owner may do it (delete the project). */
  ownerOnly: string;
  /** ALREADY_MEMBER: joining a project one is already in. */
  alreadyMember: string;
  /** RATE_LIMITED, or any 429: too many requests in a short time. */
  rateLimited: string;
  /** AVAILABILITY_BUDGET_EXCEEDED: the planner asked for too many days of too many people. */
  availabilityTooLarge: string;
}

export const ru = {
  errors: {
    notProjectMember: 'Вы больше не участник этого проекта, или проект удалён.',
    memberNotFound: 'Этого участника уже нет в проекте.',
    adminOnly: 'Это может сделать только администратор проекта.',
    ownerOnly: 'Это может сделать только владелец проекта.',
    alreadyMember: 'Вы уже участник этого проекта.',
    rateLimited: 'Слишком много запросов. Подождите немного и попробуйте снова.',
    availabilityTooLarge: 'Слишком много данных за этот период. Выберите меньше дней или участников.',
  },
};

export const en = {
  errors: {
    notProjectMember: 'You are no longer a member of this project, or it has been deleted.',
    memberNotFound: 'This person is no longer in the project.',
    adminOnly: 'Only a project admin can do this.',
    ownerOnly: 'Only the project owner can do this.',
    alreadyMember: 'You are already a member of this project.',
    rateLimited: 'Too many requests. Wait a moment and try again.',
    availabilityTooLarge: 'Too much to load at once. Choose fewer days or participants.',
  },
};

export const es = {
  errors: {
    notProjectMember: 'Ya no formas parte de este proyecto, o se ha eliminado.',
    memberNotFound: 'Esta persona ya no está en el proyecto.',
    adminOnly: 'Solo quienes administran el proyecto pueden hacerlo.',
    ownerOnly: 'Solo quien es admin principal del proyecto puede hacerlo.',
    alreadyMember: 'Ya formas parte de este proyecto.',
    rateLimited: 'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
    availabilityTooLarge: 'No se puede cargar tanto de una vez. Elige menos días o menos participantes.',
  },
};

export const de = {
  errors: {
    notProjectMember: 'Du bist nicht mehr Mitglied dieses Projekts, oder es wurde gelöscht.',
    memberNotFound: 'Diese Person ist nicht mehr im Projekt.',
    adminOnly: 'Das kann nur ein Admin des Projekts.',
    ownerOnly: 'Das kann nur der Eigentümer des Projekts.',
    alreadyMember: 'Du bist bereits Mitglied dieses Projekts.',
    rateLimited: 'Zu viele Anfragen. Warte kurz und versuche es noch einmal.',
    availabilityTooLarge: 'Zu viele Daten für diesen Zeitraum. Wähle weniger Tage oder Teilnehmer.',
  },
};
