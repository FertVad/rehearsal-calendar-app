export interface ProjectsTranslations {
  title: string;
  noProjects: string;
  createFirst: string;
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
}

export const ru = {
  projects: {
    title: 'Мои проекты',
    noProjects: 'Нет проектов',
    createFirst: 'Создайте свой первый проект, чтобы начать работу',
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
  },
};

export const en = {
  projects: {
    title: 'My Projects',
    noProjects: 'No projects',
    createFirst: 'Create your first project to get started',
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
  },
};
