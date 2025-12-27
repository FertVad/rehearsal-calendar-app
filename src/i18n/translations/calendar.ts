export interface CalendarTranslations {
  title: string;
  rehearsalsFor: string;
  noRehearsals: string;
  selectProject: string;
  myRehearsals: string;
  allProjects: string;
  filterByProject: string;
  loading: string;
  location: string;
  time: string;
  upcomingEvents: string;
  todayRehearsals: string;
  noUpcoming: string;
  tomorrow: string;
  todayButton: string;
  smartPlannerSubtitle: string;
}

export interface RehearsalsTranslations {
  addRehearsal: string;
  editRehearsal: string;
  myRehearsals: string;
  upcoming: string;
  noUpcoming: string;
  willAppear: string;
  scene: string;
  date: string;
  time: string;
  startTime: string;
  endTime: string;
  duration: string;
  notes: string;
  actors: string;
  location: string;
  project: string;
  selectProject: string;
  selectDate: string;
  selectStartTime: string;
  selectEndTime: string;
  locationPlaceholder: string;
  creating: string;
  created: string;
  createError: string;
  deleteConfirm: string;
  deleteTitle: string;
  deleteMessage: string;
  participants: string;
  createRehearsal: string;
  loadMembersError: string;
  loadAvailabilityError: string;
  projectNotSelected: string;
  endTimeError: string;
  scheduleConflict: string;
  scheduleConflictMessage: string;
  createAnyway: string;
  success: string;
  rehearsalCreated: string;
  noProjects: string;
  noAdminProjects: string;
  createNewProject: string;
  loadingMembers: string;
  noMembers: string;
  selectAll: string;
  deselectAll: string;
  expand: string;
  collapse: string;
  selectedCount: (selected: number, total: number) => string;
  admin: string;
  availableStatus: string;
  busyAllDay: string;
  busyTime: string;
}

export const ru = {
  calendar: {
    title: 'Календарь репетиций',
    rehearsalsFor: 'Репетиции на',
    noRehearsals: 'Нет репетиций на этот день',
    selectProject: 'Выберите проект в разделе "Проекты"',
    myRehearsals: 'Мои репетиции',
    allProjects: 'Все проекты',
    filterByProject: 'Фильтр по проекту',
    loading: 'Загрузка репетиций...',
    location: 'Место',
    time: 'Время',
    upcomingEvents: 'Ближайшие события',
    todayRehearsals: 'Репетиции на сегодня',
    noUpcoming: 'Нет предстоящих репетиций',
    tomorrow: 'Завтра',
    todayButton: 'Сегодня',
    smartPlannerSubtitle: 'Найти оптимальное время для репетиции',
  },
  rehearsals: {
    addRehearsal: 'Добавить репетицию',
    editRehearsal: 'Редактировать репетицию',
    myRehearsals: 'Мои репетиции',
    upcoming: 'Предстоящие',
    noUpcoming: 'Нет предстоящих репетиций',
    willAppear: 'Ваши репетиции появятся здесь, когда они будут запланированы',
    scene: 'Сцена',
    date: 'Дата',
    time: 'Время',
    startTime: 'Начало',
    endTime: 'Конец',
    duration: 'Длительность',
    notes: 'Заметки',
    actors: 'Актёры',
    location: 'Место проведения',
    project: 'Проект',
    selectProject: 'Выберите проект',
    selectDate: 'Выберите дату',
    selectStartTime: 'Выберите время начала',
    selectEndTime: 'Выберите время окончания',
    locationPlaceholder: 'Адрес или название места',
    creating: 'Создание...',
    created: 'Репетиция создана',
    createError: 'Ошибка создания репетиции',
    deleteConfirm: 'Удалить',
    deleteTitle: 'Удалить репетицию?',
    deleteMessage: 'Это действие нельзя отменить',
    participants: 'Участники',
    createRehearsal: 'Создать репетицию',
    loadMembersError: 'Не удалось загрузить участников проекта',
    loadAvailabilityError: 'Не удалось загрузить доступность участников',
    projectNotSelected: 'Выберите проект для создания репетиции',
    endTimeError: 'Время окончания должно быть позже времени начала',
    scheduleConflict: '⚠️ Конфликт расписания',
    scheduleConflictMessage: 'Вы уверены, что хотите создать репетицию?',
    createAnyway: 'Создать всё равно',
    success: 'Успешно',
    rehearsalCreated: 'Репетиция создана',
    noProjects: 'Нет проектов',
    noAdminProjects: 'Нет проектов, где вы являетесь администратором',
    createNewProject: 'Создать новый проект',
    loadingMembers: 'Загрузка участников...',
    noMembers: 'Нет участников в проекте',
    selectAll: 'Выбрать всех',
    deselectAll: 'Снять выделение',
    expand: 'Развернуть',
    collapse: 'Свернуть',
    selectedCount: (selected: number, total: number) => `Выбрано: ${selected} из ${total}`,
    admin: 'Админ',
    availableStatus: 'Свободен',
    busyAllDay: 'Занят весь день',
    busyTime: 'Занят',
  },
};

export const en = {
  calendar: {
    title: 'Rehearsal Calendar',
    rehearsalsFor: 'Rehearsals for',
    noRehearsals: 'No rehearsals for this day',
    selectProject: 'Select a project in "Projects" section',
    myRehearsals: 'My Rehearsals',
    allProjects: 'All Projects',
    filterByProject: 'Filter by Project',
    loading: 'Loading rehearsals...',
    location: 'Location',
    time: 'Time',
    upcomingEvents: 'Upcoming Events',
    todayRehearsals: "Today's Rehearsals",
    noUpcoming: 'No upcoming rehearsals',
    tomorrow: 'Tomorrow',
    todayButton: 'Today',
    smartPlannerSubtitle: 'Find the best time for rehearsal',
  },
  rehearsals: {
    addRehearsal: 'Add Rehearsal',
    editRehearsal: 'Edit Rehearsal',
    myRehearsals: 'My Rehearsals',
    upcoming: 'Upcoming',
    noUpcoming: 'No upcoming rehearsals',
    willAppear: 'Your rehearsals will appear here when they are scheduled',
    scene: 'Scene',
    date: 'Date',
    time: 'Time',
    startTime: 'Start Time',
    endTime: 'End Time',
    duration: 'Duration',
    notes: 'Notes',
    actors: 'Actors',
    location: 'Location',
    project: 'Project',
    selectProject: 'Select Project',
    selectDate: 'Select Date',
    selectStartTime: 'Select Start Time',
    selectEndTime: 'Select End Time',
    locationPlaceholder: 'Address or venue name',
    creating: 'Creating...',
    created: 'Rehearsal created',
    createError: 'Error creating rehearsal',
    deleteConfirm: 'Delete',
    deleteTitle: 'Delete Rehearsal?',
    deleteMessage: 'This action cannot be undone',
    participants: 'Participants',
    createRehearsal: 'Create Rehearsal',
    loadMembersError: 'Failed to load project members',
    loadAvailabilityError: 'Failed to load member availability',
    projectNotSelected: 'Select a project to create a rehearsal',
    endTimeError: 'End time must be after start time',
    scheduleConflict: '⚠️ Schedule Conflict',
    scheduleConflictMessage: 'Are you sure you want to create this rehearsal?',
    createAnyway: 'Create Anyway',
    success: 'Success',
    rehearsalCreated: 'Rehearsal created',
    noProjects: 'No projects',
    noAdminProjects: 'No projects where you are an administrator',
    createNewProject: 'Create New Project',
    loadingMembers: 'Loading members...',
    noMembers: 'No members in project',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    expand: 'Expand',
    collapse: 'Collapse',
    selectedCount: (selected: number, total: number) => `Selected: ${selected} of ${total}`,
    admin: 'Admin',
    availableStatus: 'Available',
    busyAllDay: 'Busy all day',
    busyTime: 'Busy',
  },
};
