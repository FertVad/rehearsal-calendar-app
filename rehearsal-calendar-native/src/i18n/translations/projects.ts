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
    noProjects: 'Нет проектов',
    createFirst: 'Создайте свой первый проект, чтобы начать работу',
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
    shareInviteMessage: (projectName: string) => `Присоединяйся к проекту "${projectName}" в приложении Rehearsal:`,
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
    noProjects: 'No projects',
    createFirst: 'Create your first project to get started',
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
    shareInviteMessage: (projectName: string) => `Join the project "${projectName}" in the Rehearsal app:`,
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
