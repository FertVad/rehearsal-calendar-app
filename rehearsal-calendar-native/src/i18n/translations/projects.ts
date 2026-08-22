export interface ProjectsTranslations {
  title: string;
  noProjects: string;
  createFirst: string;
  createToUsePlanner: string;
  admin: string;
  createProject: string;
  projectName: string;
  projectDescription: string;
  create: string;
  inviteLink: string;
  copyLink: string;
  linkCopied: string;
  loading: string;
  selectProject: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  nameRequired: string;
  createError: string;
  projectNotFound: string;
  owner: string;
  member: string;
  upcomingRehearsals: string;
  pastRehearsals: string;
  noUpcomingRehearsals: string;
  inviteMembers: string;
  members: string;
  timezone: string;
  selectTimezone: string;
  inviteLinkCopied: string;
  inviteLinkError: string;
  fetchError: string;
  haveInvite: string;
  inviteCodeLabel: string;
  shareLink: string;
  showCode: string;
  codeCopied: string;
  joinByCode: string;
  joinByCodeSubtitle: string;
  joinByCodePlaceholder: string;
  tryAgain: string;
  shareInviteMessage: (projectName: string) => string;
  shareInviteTitle: (projectName: string) => string;
  manageMember: string;
  makeAdmin: string;
  removeAdmin: string;
  removeMember: string;
  cancel: string;
  removeMemberConfirm: string;
  removeMemberMessage: (memberName: string) => string;
  makeAdminConfirm: string;
  makeAdminMessage: (memberName: string) => string;
  removeAdminConfirm: string;
  removeAdminMessage: (memberName: string) => string;
  memberRemoved: string;
  roleUpdated: string;
  memberActionError: string;
  deleteProject: string;
  deleteProjectConfirm: string;
  deleteProjectMessage: (projectName: string) => string;
  deleteProjectWarning: string;
  projectDeleted: string;
  deleteProjectError: string;
  inviteNotFound: string;
  inviteExpired: string;
  inviteLoadError: string;
  joinError: string;
  loadingInvite: string;
  error: string;
  close: string;
  projectInvitation: string;
  inviteSubtitle: string;
  join: string;
}

export const ru = {
  projects: {
    title: 'Мои проекты',
    noProjects: 'Тут будут ваши проекты',
    createFirst: 'Создайте свой или вступите в чужой',
    createToUsePlanner: 'Сначала создайте проект, чтобы использовать планировщик',
    admin: 'Админ',
    createProject: 'Создать проект',
    projectName: 'Название проекта',
    projectDescription: 'Описание',
    create: 'Создать',
    inviteLink: 'Пригласить',
    copyLink: 'Копировать ссылку',
    linkCopied: 'Ссылка скопирована!',
    loading: 'Загрузка проектов...',
    selectProject: 'Выбрать проект',
    namePlaceholder: 'Введите название',
    descriptionPlaceholder: 'Введите описание',
    nameRequired: 'Название обязательно',
    createError: 'Ошибка создания проекта',
    projectNotFound: 'Проект не найден',
    owner: 'Владелец',
    member: 'Участник',
    upcomingRehearsals: 'Ближайшие репетиции',
    pastRehearsals: 'Прошедшие репетиции',
    noUpcomingRehearsals: 'Нет запланированных репетиций',
    inviteMembers: 'Пригласить участников',
    members: 'Участники',
    timezone: 'Часовой пояс',
    selectTimezone: 'Выберите часовой пояс',
    inviteLinkCopied: 'Ссылка-приглашение скопирована в буфер обмена',
    inviteLinkError: 'Не удалось создать ссылку-приглашение',
    fetchError: 'Не удалось загрузить данные проекта',
    shareLink: 'Поделиться ссылкой',
    showCode: 'Показать код',
    inviteCodeLabel: 'Код приглашения',
    codeCopied: 'Код скопирован',
    haveInvite: 'Присоединиться по коду',
    joinByCode: 'Вступить в проект',
    joinByCodeSubtitle: 'Введите код или вставьте ссылку из приглашения',
    joinByCodePlaceholder: 'Код или ссылка',
    tryAgain: 'Ввести другой код',
    shareInviteMessage: (projectName: string) => `Присоединяйся к проекту "${projectName}" в приложении Rehearsly:`,
    shareInviteTitle: (projectName: string) => `Приглашение в проект ${projectName}`,
    manageMember: 'Управление участником',
    makeAdmin: 'Сделать администратором',
    removeAdmin: 'Снять права администратора',
    removeMember: 'Удалить из проекта',
    cancel: 'Отмена',
    removeMemberConfirm: 'Удалить участника?',
    removeMemberMessage: (memberName: string) => `Вы уверены, что хотите удалить ${memberName} из проекта?`,
    makeAdminConfirm: 'Назначить администратором?',
    makeAdminMessage: (memberName: string) => `Вы уверены, что хотите назначить ${memberName} администратором проекта?`,
    removeAdminConfirm: 'Снять права администратора?',
    removeAdminMessage: (memberName: string) => `Вы уверены, что хотите снять права администратора у ${memberName}?`,
    memberRemoved: 'Участник удален из проекта',
    roleUpdated: 'Роль участника обновлена',
    memberActionError: 'Не удалось выполнить действие',
    deleteProject: 'Удалить проект',
    deleteProjectConfirm: 'Удалить проект?',
    deleteProjectMessage: (projectName: string) => `Вы уверены, что хотите удалить проект "${projectName}"?`,
    deleteProjectWarning: 'Все репетиции, участники и данные проекта будут удалены без возможности восстановления.',
    projectDeleted: 'Проект успешно удален',
    deleteProjectError: 'Не удалось удалить проект',
    inviteNotFound: 'Приглашение не найдено',
    inviteExpired: 'Срок действия приглашения истек',
    inviteLoadError: 'Не удалось загрузить информацию о приглашении',
    joinError: 'Не удалось присоединиться к проекту',
    loadingInvite: 'Загрузка приглашения...',
    error: 'Ошибка',
    close: 'Закрыть',
    projectInvitation: 'Приглашение в проект',
    inviteSubtitle: 'Вас приглашают присоединиться к этому проекту',
    join: 'Присоединиться',
  },
};

export const en = {
  projects: {
    title: 'My Projects',
    noProjects: 'Your projects will be here',
    createFirst: 'Create one, or join someone else\'s',
    createToUsePlanner: 'Create a project first to use the planner',
    admin: 'Admin',
    createProject: 'Create Project',
    projectName: 'Project Name',
    projectDescription: 'Description',
    create: 'Create',
    inviteLink: 'Invite',
    copyLink: 'Copy Link',
    linkCopied: 'Link copied!',
    loading: 'Loading projects...',
    selectProject: 'Select Project',
    namePlaceholder: 'Enter name',
    descriptionPlaceholder: 'Enter description',
    nameRequired: 'Name is required',
    createError: 'Error creating project',
    projectNotFound: 'Project not found',
    owner: 'Owner',
    member: 'Member',
    upcomingRehearsals: 'Upcoming Rehearsals',
    pastRehearsals: 'Past Rehearsals',
    noUpcomingRehearsals: 'No upcoming rehearsals',
    inviteMembers: 'Invite Members',
    members: 'Members',
    timezone: 'Timezone',
    selectTimezone: 'Select Timezone',
    inviteLinkCopied: 'Invite link copied to clipboard',
    inviteLinkError: 'Failed to create invite link',
    fetchError: 'Failed to load project data',
    shareLink: 'Share the link',
    showCode: 'Show the code',
    inviteCodeLabel: 'Invite code',
    codeCopied: 'Code copied',
    haveInvite: 'Join with a code',
    joinByCode: 'Join a project',
    joinByCodeSubtitle: 'Enter the code, or paste the invite link',
    joinByCodePlaceholder: 'Code or link',
    tryAgain: 'Try another code',
    shareInviteMessage: (projectName: string) => `Join the project "${projectName}" in the Rehearsly app:`,
    shareInviteTitle: (projectName: string) => `Invitation to project ${projectName}`,
    manageMember: 'Manage Member',
    makeAdmin: 'Make Admin',
    removeAdmin: 'Remove Admin Rights',
    removeMember: 'Remove from Project',
    cancel: 'Cancel',
    removeMemberConfirm: 'Remove Member?',
    removeMemberMessage: (memberName: string) => `Are you sure you want to remove ${memberName} from the project?`,
    makeAdminConfirm: 'Make Admin?',
    makeAdminMessage: (memberName: string) => `Are you sure you want to make ${memberName} an admin of this project?`,
    removeAdminConfirm: 'Remove Admin Rights?',
    removeAdminMessage: (memberName: string) => `Are you sure you want to remove admin rights from ${memberName}?`,
    memberRemoved: 'Member removed from project',
    roleUpdated: 'Member role updated',
    memberActionError: 'Failed to perform action',
    deleteProject: 'Delete Project',
    deleteProjectConfirm: 'Delete Project?',
    deleteProjectMessage: (projectName: string) => `Are you sure you want to delete the project "${projectName}"?`,
    deleteProjectWarning: 'All rehearsals, members, and project data will be permanently deleted.',
    projectDeleted: 'Project successfully deleted',
    deleteProjectError: 'Failed to delete project',
    inviteNotFound: 'Invitation not found',
    inviteExpired: 'Invitation has expired',
    inviteLoadError: 'Failed to load invitation info',
    joinError: 'Failed to join project',
    loadingInvite: 'Loading invitation...',
    error: 'Error',
    close: 'Close',
    projectInvitation: 'Project Invitation',
    inviteSubtitle: 'You are invited to join this project',
    join: 'Join',
  },
};

export const es = {
  projects: {
    title: 'Mis proyectos',
    noProjects: 'Aquí estarán sus proyectos',
    createFirst: 'Creen uno, o únanse a otro',
    createToUsePlanner: 'Primero crea un proyecto para usar el planificador',
    admin: 'Admin',
    createProject: 'Crear proyecto',
    projectName: 'Nombre del proyecto',
    projectDescription: 'Descripción',
    create: 'Crear',
    inviteLink: 'Invitar',
    copyLink: 'Copiar enlace',
    linkCopied: '¡Enlace copiado!',
    loading: 'Cargando proyectos...',
    selectProject: 'Seleccionar proyecto',
    namePlaceholder: 'Introduce el nombre',
    descriptionPlaceholder: 'Introduce la descripción',
    nameRequired: 'El nombre es obligatorio',
    createError: 'Error al crear el proyecto',
    projectNotFound: 'Proyecto no encontrado',
    owner: 'Propietario',
    member: 'Miembro',
    upcomingRehearsals: 'Próximos ensayos',
    pastRehearsals: 'Ensayos pasados',
    noUpcomingRehearsals: 'No hay ensayos programados',
    inviteMembers: 'Invitar miembros',
    members: 'Miembros',
    timezone: 'Zona horaria',
    selectTimezone: 'Seleccionar zona horaria',
    inviteLinkCopied: 'Enlace de invitación copiado al portapapeles',
    inviteLinkError: 'No se pudo crear el enlace de invitación',
    fetchError: 'No se pudieron cargar los datos del proyecto',
    shareLink: 'Compartir el enlace',
    showCode: 'Mostrar el código',
    inviteCodeLabel: 'Código de invitación',
    codeCopied: 'Código copiado',
    haveInvite: 'Unirse con un código',
    joinByCode: 'Unirse a un proyecto',
    joinByCodeSubtitle: 'Escriban el código o peguen el enlace',
    joinByCodePlaceholder: 'Código o enlace',
    tryAgain: 'Probar otro código',
    shareInviteMessage: (projectName: string) => `Únete al proyecto "${projectName}" en la app Rehearsly:`,
    shareInviteTitle: (projectName: string) => `Invitación al proyecto ${projectName}`,
    manageMember: 'Gestionar miembro',
    makeAdmin: 'Hacer administrador',
    removeAdmin: 'Quitar permisos de administrador',
    removeMember: 'Eliminar del proyecto',
    cancel: 'Cancelar',
    removeMemberConfirm: '¿Eliminar miembro?',
    removeMemberMessage: (memberName: string) => `¿Seguro que quieres eliminar a ${memberName} del proyecto?`,
    makeAdminConfirm: '¿Hacer administrador?',
    makeAdminMessage: (memberName: string) => `¿Seguro que quieres convertir a ${memberName} en administrador del proyecto?`,
    removeAdminConfirm: '¿Quitar permisos de administrador?',
    removeAdminMessage: (memberName: string) => `¿Seguro que quieres quitarle a ${memberName} los permisos de administrador?`,
    memberRemoved: 'Miembro eliminado del proyecto',
    roleUpdated: 'Rol del miembro actualizado',
    memberActionError: 'No se pudo realizar la acción',
    deleteProject: 'Eliminar proyecto',
    deleteProjectConfirm: '¿Eliminar proyecto?',
    deleteProjectMessage: (projectName: string) => `¿Seguro que quieres eliminar el proyecto "${projectName}"?`,
    deleteProjectWarning: 'Todos los ensayos, miembros y datos del proyecto se eliminarán de forma permanente.',
    projectDeleted: 'Proyecto eliminado correctamente',
    deleteProjectError: 'No se pudo eliminar el proyecto',
    inviteNotFound: 'Invitación no encontrada',
    inviteExpired: 'La invitación ha caducado',
    inviteLoadError: 'No se pudo cargar la información de la invitación',
    joinError: 'No se pudo unir al proyecto',
    loadingInvite: 'Cargando invitación...',
    error: 'Error',
    close: 'Cerrar',
    projectInvitation: 'Invitación al proyecto',
    inviteSubtitle: 'Te invitan a unirte a este proyecto',
    join: 'Unirse',
  },
};

export const de = {
  projects: {
    title: 'Meine Projekte',
    noProjects: 'Hier stehen deine Projekte',
    createFirst: 'Erstell eins, oder tritt einem bei',
    createToUsePlanner: 'Erstelle zuerst ein Projekt, um den Planer zu nutzen',
    admin: 'Admin',
    createProject: 'Projekt erstellen',
    projectName: 'Projektname',
    projectDescription: 'Beschreibung',
    create: 'Erstellen',
    inviteLink: 'Einladen',
    copyLink: 'Link kopieren',
    linkCopied: 'Link kopiert!',
    loading: 'Projekte werden geladen...',
    selectProject: 'Projekt auswählen',
    namePlaceholder: 'Namen eingeben',
    descriptionPlaceholder: 'Beschreibung eingeben',
    nameRequired: 'Name ist erforderlich',
    createError: 'Fehler beim Erstellen des Projekts',
    projectNotFound: 'Projekt nicht gefunden',
    owner: 'Eigentümer',
    member: 'Mitglied',
    upcomingRehearsals: 'Bevorstehende Proben',
    pastRehearsals: 'Vergangene Proben',
    noUpcomingRehearsals: 'Keine geplanten Proben',
    inviteMembers: 'Mitglieder einladen',
    members: 'Mitglieder',
    timezone: 'Zeitzone',
    selectTimezone: 'Zeitzone auswählen',
    inviteLinkCopied: 'Einladungslink in die Zwischenablage kopiert',
    inviteLinkError: 'Einladungslink konnte nicht erstellt werden',
    fetchError: 'Projektdaten konnten nicht geladen werden',
    shareLink: 'Link teilen',
    showCode: 'Code anzeigen',
    inviteCodeLabel: 'Einladungscode',
    codeCopied: 'Code kopiert',
    haveInvite: 'Mit einem Code beitreten',
    joinByCode: 'Einem Projekt beitreten',
    joinByCodeSubtitle: 'Gib den Code ein oder füg den Link ein',
    joinByCodePlaceholder: 'Code oder Link',
    tryAgain: 'Anderen Code versuchen',
    shareInviteMessage: (projectName: string) => `Tritt dem Projekt „${projectName}" in der Rehearsly-App bei:`,
    shareInviteTitle: (projectName: string) => `Einladung zum Projekt ${projectName}`,
    manageMember: 'Mitglied verwalten',
    makeAdmin: 'Zum Administrator machen',
    removeAdmin: 'Administratorrechte entfernen',
    removeMember: 'Aus dem Projekt entfernen',
    cancel: 'Abbrechen',
    removeMemberConfirm: 'Mitglied entfernen?',
    removeMemberMessage: (memberName: string) => `Möchtest du ${memberName} wirklich aus dem Projekt entfernen?`,
    makeAdminConfirm: 'Zum Administrator machen?',
    makeAdminMessage: (memberName: string) => `Möchtest du ${memberName} wirklich zum Administrator des Projekts machen?`,
    removeAdminConfirm: 'Administratorrechte entfernen?',
    removeAdminMessage: (memberName: string) => `Möchtest du ${memberName} wirklich die Administratorrechte entziehen?`,
    memberRemoved: 'Mitglied aus dem Projekt entfernt',
    roleUpdated: 'Rolle des Mitglieds aktualisiert',
    memberActionError: 'Aktion konnte nicht ausgeführt werden',
    deleteProject: 'Projekt löschen',
    deleteProjectConfirm: 'Projekt löschen?',
    deleteProjectMessage: (projectName: string) => `Möchtest du das Projekt „${projectName}" wirklich löschen?`,
    deleteProjectWarning: 'Alle Proben, Mitglieder und Projektdaten werden unwiderruflich gelöscht.',
    projectDeleted: 'Projekt erfolgreich gelöscht',
    deleteProjectError: 'Projekt konnte nicht gelöscht werden',
    inviteNotFound: 'Einladung nicht gefunden',
    inviteExpired: 'Die Einladung ist abgelaufen',
    inviteLoadError: 'Einladungsinformationen konnten nicht geladen werden',
    joinError: 'Beitritt zum Projekt fehlgeschlagen',
    loadingInvite: 'Einladung wird geladen...',
    error: 'Fehler',
    close: 'Schließen',
    projectInvitation: 'Projekteinladung',
    inviteSubtitle: 'Du bist eingeladen, diesem Projekt beizutreten',
    join: 'Beitreten',
  },
};
