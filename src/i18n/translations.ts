export type Language = 'ru' | 'en';

export interface Translations {
  // Common
  common: {
    save: string;
    cancel: string;
    delete: string;
    add: string;
    edit: string;
    close: string;
    today: string;
    loading: string;
    error: string;
    noData: string;
    apply: string;
    or: string;
    selectAll: string;
    clear: string;
    change: string;
    selectPeriod: string;
    from: string;
    to: string;
    done: string;
  };
  // Navigation
  nav: {
    calendar: string;
    projects: string;
    addRehearsal: string;
    profile: string;
  };
  // Auth
  auth: {
    login: string;
    register: string;
    loginTitle: string;
    registerTitle: string;
    loginSubtitle: string;
    registerSubtitle: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    confirmPassword: string;
    loginButton: string;
    registerButton: string;
    createAccount: string;
    alreadyHaveAccount: string;
    loginWithTelegram: string;
    registerWithTelegram: string;
    fillAllFields: string;
    invalidEmail: string;
    passwordMinLength: string;
    passwordsMismatch: string;
    loginError: string;
    registerError: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    firstNamePlaceholder: string;
    lastNamePlaceholder: string;
    confirmPasswordPlaceholder: string;
    required: string;
    optional: string;
  };
  // Calendar
  calendar: {
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
    willAttend: string;
    wontAttend: string;
    attendanceConfirmed: string;
    attendanceDeclined: string;
  };
  // Projects
  projects: {
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
  };
  // Profile
  profile: {
    title: string;
    settings: string;
    notifications: string;
    language: string;
    theme: string;
    themeDark: string;
    themeLight: string;
    availability: string;
    about: string;
    version: string;
    help: string;
    logout: string;
  };
  // Rehearsals
  rehearsals: {
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
    rsvpConfirmed: string;
    rsvpDeclined: string;
    rsvpPending: string;
    confirmAttendance: string;
    declineAttendance: string;
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
  };
  // Availability
  availability: {
    title: string;
    available: string;
    unavailable: string;
    timeSlots: string;
    addSlot: string;
    from: string;
    to: string;
    free: string;
    busy: string;
    partial: string;
    legend: string;
    saving: string;
    saved: string;
    saveError: string;
    selectDates: string;
    busyTime: string;
    startTime: string;
    endTime: string;
    deleteData: string;
    deleteDataConfirm: string;
    deleteDataMessage: string;
    pastDateWarning: string;
    cannotSave: string;
    invalidSlot: string;
    slotsOverlap: string;
    fixSlots: string;
    understood: string;
    selectedDates: (count: number) => string;
    freeAllDay: string;
    busyAllDay: string;
  };
  // Smart Planner
  smartPlanner: {
    title: string;
    period: string;
    members: string;
    recommendations: string;
    analyzing: string;
    noSlots: string;
    noSlotsMessage: string;
    errorLoading: string;
    week: string;
    twoWeeks: string;
    month: string;
    custom: string;
    customPeriod: string;
    slots: string;
    allDay: string;
    addButton: string;
    selectAll: string;
    clearAll: string;
    selectMembers: string;
    applyFilter: string;
    perfect: string;
    good: string;
    possible: string;
    difficult: string;
    available: string;
    busy: string;
    selectedMembers: string;
    allMembers: string;
    noneSelected: string;
    allAvailable: string;
    allBusy: string;
    busyPrefix: string;
  };
  // Calendar Sync
  calendarSync: {
    // Navigation
    title: string;
    // Permissions
    permissions: string;
    permissionGranted: string;
    permissionDenied: string;
    permissionDeniedMessage: string;
    permissionRequired: string;
    grantPermission: string;
    permissionInstructions: string;
    checkingPermissions: string;
    // Export Settings
    exportSettings: string;
    exportEnabled: string;
    exportCalendar: string;
    selectCalendar: string;
    targetCalendar: string;
    noCalendarSelected: string;
    selectCalendarFirst: string;
    // Actions
    actions: string;
    exportAll: string;
    exportAllProgress: (current: number, total: number) => string;
    removeAll: string;
    removeAllConfirm: string;
    // Status
    status: string;
    lastSynced: string;
    lastSync: string;
    neverSynced: string;
    syncedCount: string;
    never: string;
    syncing: string;
    syncSuccess: string;
    exportSuccess: string;
    exportAllSuccess: string;
    removeSuccess: string;
    removeAllSuccess: string;
    syncError: string;
    exportError: string;
    exportErrorMessage: string;
    rehearsalsSynced: (count: number) => string;
    // Rehearsal indicators
    syncedToCalendar: string;
    notSynced: string;
    // Errors
    noCalendars: string;
    noCalendarsMessage: string;
    noWritableCalendars: string;
    exportFailed: string;
    deleteFailed: string;
  };
  // Days
  days: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
    short: {
      monday: string;
      tuesday: string;
      wednesday: string;
      thursday: string;
      friday: string;
      saturday: string;
      sunday: string;
    };
  };
  // Months
  months: string[];
}

export const ru: Translations = {
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    add: 'Добавить',
    edit: 'Редактировать',
    close: 'Закрыть',
    today: 'Сегодня',
    loading: 'Загрузка...',
    error: 'Ошибка',
    noData: 'Нет данных',
    apply: 'Применить',
    or: 'или',
    selectAll: 'Выбрать всех',
    clear: 'Очистить',
    change: 'Сменить',
    selectPeriod: 'Выберите период',
    from: 'От:',
    to: 'До:',
    done: 'Готово',
  },
  nav: {
    calendar: 'Календарь',
    projects: 'Мои проекты',
    addRehearsal: 'Добавить',
    profile: 'Профиль',
  },
  auth: {
    login: 'Вход',
    register: 'Регистрация',
    loginTitle: 'Rehearsal Calendar',
    registerTitle: 'Создать аккаунт',
    loginSubtitle: 'Войдите в свой аккаунт',
    registerSubtitle: 'Присоединяйтесь к Rehearsal Calendar',
    email: 'Email',
    password: 'Пароль',
    firstName: 'Имя',
    lastName: 'Фамилия',
    confirmPassword: 'Подтвердите пароль',
    loginButton: 'Войти',
    registerButton: 'Зарегистрироваться',
    createAccount: 'Создать аккаунт',
    alreadyHaveAccount: 'Уже есть аккаунт? Войти',
    loginWithTelegram: 'Войти через Telegram',
    registerWithTelegram: 'Зарегистрироваться через Telegram',
    fillAllFields: 'Заполните все поля',
    invalidEmail: 'Неверный формат email',
    passwordMinLength: 'Пароль должен содержать минимум 6 символов',
    passwordsMismatch: 'Пароли не совпадают',
    loginError: 'Ошибка входа',
    registerError: 'Ошибка регистрации',
    emailPlaceholder: 'your@email.com',
    passwordPlaceholder: '••••••••',
    firstNamePlaceholder: 'Ваше имя',
    lastNamePlaceholder: 'Ваша фамилия (опционально)',
    confirmPasswordPlaceholder: 'Повторите пароль',
    required: '*',
    optional: '(опционально)',
  },
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
    willAttend: 'Приду',
    wontAttend: 'Не приду',
    attendanceConfirmed: 'Репетиция подтверждена',
    attendanceDeclined: 'Вы отказались',
  },
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
  },
  profile: {
    title: 'Профиль',
    settings: 'Настройки',
    notifications: 'Уведомления',
    language: 'Язык',
    theme: 'Тема',
    themeDark: 'Тёмная',
    themeLight: 'Светлая',
    availability: 'Моя доступность',
    about: 'О приложении',
    version: 'Версия',
    help: 'Помощь',
    logout: 'Выйти из аккаунта',
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
    rsvpConfirmed: 'Подтвердили',
    rsvpDeclined: 'Отказались',
    rsvpPending: 'Ожидают',
    confirmAttendance: 'Подтвердить',
    declineAttendance: 'Отказаться',
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
  smartPlanner: {
    title: 'Smart Planner',
    period: 'Период',
    members: 'Участники',
    recommendations: 'Рекомендации',
    analyzing: 'Анализируем доступность...',
    noSlots: 'Нет доступных слотов',
    noSlotsMessage: 'Попробуйте выбрать другой период или участников',
    errorLoading: 'Ошибка загрузки',
    week: 'Неделя',
    twoWeeks: 'Две недели',
    month: 'Месяц',
    custom: 'Свой',
    customPeriod: 'Свой период',
    slots: 'слотов',
    allDay: 'Весь день',
    addButton: '+ Добавить',
    selectAll: 'Все',
    clearAll: 'Очистить',
    selectMembers: 'Участники',
    applyFilter: 'Применить',
    perfect: 'Идеально',
    good: 'Хорошо',
    possible: 'Возможно',
    difficult: 'Сложно',
    available: 'Свободны',
    busy: 'Заняты',
    selectedMembers: 'выбрано',
    allMembers: 'Все участники',
    noneSelected: 'Никто не выбран',
    allAvailable: 'Все свободны',
    allBusy: 'Все заняты',
    busyPrefix: 'Заняты',
  },
  calendarSync: {
    // Navigation
    title: 'Синхронизация с календарём',
    // Permissions
    permissions: 'Разрешения',
    permissionGranted: 'Доступ предоставлен',
    permissionDenied: 'Доступ запрещён',
    permissionDeniedMessage: 'Для использования этой функции необходим доступ к календарю',
    permissionRequired: 'Требуется доступ к календарю',
    grantPermission: 'Предоставить доступ',
    permissionInstructions: 'Разрешите доступ к календарю для синхронизации репетиций',
    checkingPermissions: 'Проверка разрешений...',
    // Export Settings
    exportSettings: 'Настройки экспорта',
    exportEnabled: 'Экспортировать репетиции',
    exportCalendar: 'Календарь для экспорта',
    selectCalendar: 'Выбрать календарь',
    targetCalendar: 'Целевой календарь',
    noCalendarSelected: 'Календарь не выбран',
    selectCalendarFirst: 'Сначала выберите календарь',
    // Actions
    actions: 'Действия',
    exportAll: 'Экспортировать все репетиции',
    exportAllProgress: (current: number, total: number) => `Экспорт ${current} из ${total}...`,
    removeAll: 'Удалить все экспортированные',
    removeAllConfirm: 'Удалить все репетиции из календаря?',
    // Status
    status: 'Статус',
    lastSynced: 'Последняя синхронизация',
    lastSync: 'Последняя синхронизация',
    neverSynced: 'Никогда не синхронизировалось',
    syncedCount: 'Синхронизировано репетиций',
    never: 'Никогда',
    syncing: 'Синхронизация...',
    syncSuccess: 'Успешно синхронизировано',
    exportSuccess: 'Успешно экспортировано',
    exportAllSuccess: 'Все репетиции экспортированы',
    removeSuccess: 'Успешно удалено',
    removeAllSuccess: 'Все репетиции удалены из календаря',
    syncError: 'Ошибка синхронизации',
    exportError: 'Ошибка экспорта',
    exportErrorMessage: 'Не удалось экспортировать репетиции',
    rehearsalsSynced: (count: number) => `Синхронизировано репетиций: ${count}`,
    // Rehearsal indicators
    syncedToCalendar: 'Добавлено в календарь',
    notSynced: 'Не синхронизировано',
    // Errors
    noCalendars: 'Календари не найдены',
    noCalendarsMessage: 'На устройстве не найдено доступных календарей',
    noWritableCalendars: 'Нет календарей для записи',
    exportFailed: 'Не удалось экспортировать',
    deleteFailed: 'Не удалось удалить из календаря',
  },
  availability: {
    title: 'Занятость',
    available: 'Доступен',
    unavailable: 'Недоступен',
    timeSlots: 'Временные слоты',
    addSlot: 'Добавить слот',
    from: 'С',
    to: 'До',
    free: 'Свободен',
    busy: 'Занят',
    partial: 'Частично',
    legend: 'Легенда',
    saving: 'Сохранение...',
    saved: 'Занятость сохранена',
    saveError: 'Не удалось сохранить занятость',
    selectDates: 'Выберите даты',
    busyTime: 'Время когда занят',
    startTime: 'Время начала',
    endTime: 'Время окончания',
    deleteData: 'Удалить данные этой даты',
    deleteDataConfirm: 'Удалить данные?',
    deleteDataMessage: 'Вы уверены, что хотите удалить данные занятости для этой прошедшей даты?',
    pastDateWarning: 'Это прошедшая дата. Вы можете удалить данные, но не редактировать.',
    cannotSave: 'Невозможно сохранить',
    invalidSlot: 'Пожалуйста, исправьте время слотов и попробуйте снова.',
    slotsOverlap: 'Слоты не должны пересекаться',
    fixSlots: 'Пожалуйста, исправьте время слотов и попробуйте снова.',
    understood: 'Понятно',
    selectedDates: (count: number) => `Выбрано дат: ${count}`,
    freeAllDay: 'Вы доступны весь день для репетиций',
    busyAllDay: 'Вы недоступны в этот день',
  },
  days: {
    monday: 'Понедельник',
    tuesday: 'Вторник',
    wednesday: 'Среда',
    thursday: 'Четверг',
    friday: 'Пятница',
    saturday: 'Суббота',
    sunday: 'Воскресенье',
    short: {
      monday: 'Пн',
      tuesday: 'Вт',
      wednesday: 'Ср',
      thursday: 'Чт',
      friday: 'Пт',
      saturday: 'Сб',
      sunday: 'Вс',
    },
  },
  months: [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ],
};

export const en: Translations = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    add: 'Add',
    edit: 'Edit',
    close: 'Close',
    today: 'Today',
    loading: 'Loading...',
    error: 'Error',
    noData: 'No data',
    apply: 'Apply',
    or: 'or',
    selectAll: 'Select All',
    clear: 'Clear',
    change: 'Change',
    selectPeriod: 'Select Period',
    from: 'From:',
    to: 'To:',
    done: 'Done',
  },
  nav: {
    calendar: 'Calendar',
    projects: 'My Projects',
    addRehearsal: 'Add',
    profile: 'Profile',
  },
  auth: {
    login: 'Login',
    register: 'Sign Up',
    loginTitle: 'Rehearsal Calendar',
    registerTitle: 'Create Account',
    loginSubtitle: 'Sign in to your account',
    registerSubtitle: 'Join Rehearsal Calendar',
    email: 'Email',
    password: 'Password',
    firstName: 'First Name',
    lastName: 'Last Name',
    confirmPassword: 'Confirm Password',
    loginButton: 'Sign In',
    registerButton: 'Sign Up',
    createAccount: 'Create Account',
    alreadyHaveAccount: 'Already have an account? Sign In',
    loginWithTelegram: 'Sign in with Telegram',
    registerWithTelegram: 'Sign up with Telegram',
    fillAllFields: 'Fill in all fields',
    invalidEmail: 'Invalid email format',
    passwordMinLength: 'Password must be at least 6 characters',
    passwordsMismatch: 'Passwords do not match',
    loginError: 'Login Error',
    registerError: 'Registration Error',
    emailPlaceholder: 'your@email.com',
    passwordPlaceholder: '••••••••',
    firstNamePlaceholder: 'Your first name',
    lastNamePlaceholder: 'Your last name (optional)',
    confirmPasswordPlaceholder: 'Repeat password',
    required: '*',
    optional: '(optional)',
  },
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
    willAttend: "I'll attend",
    wontAttend: "Won't attend",
    attendanceConfirmed: 'Attendance confirmed',
    attendanceDeclined: 'You declined',
  },
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
  },
  profile: {
    title: 'Profile',
    settings: 'Settings',
    notifications: 'Notifications',
    language: 'Language',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    availability: 'My Availability',
    about: 'About',
    version: 'Version',
    help: 'Help',
    logout: 'Log out',
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
    rsvpConfirmed: 'Confirmed',
    rsvpDeclined: 'Declined',
    rsvpPending: 'Pending',
    confirmAttendance: 'Confirm',
    declineAttendance: 'Decline',
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
  smartPlanner: {
    title: 'Smart Planner',
    period: 'Period',
    members: 'Members',
    recommendations: 'Recommendations',
    analyzing: 'Analyzing availability...',
    noSlots: 'No available slots',
    noSlotsMessage: 'Try selecting a different period or members',
    errorLoading: 'Error loading',
    week: 'Week',
    twoWeeks: 'Two Weeks',
    month: 'Month',
    custom: 'Custom',
    customPeriod: 'Custom Period',
    slots: 'slots',
    allDay: 'All day',
    addButton: '+ Add',
    selectAll: 'All',
    clearAll: 'Clear',
    selectMembers: 'Members',
    applyFilter: 'Apply',
    perfect: 'Perfect',
    good: 'Good',
    possible: 'Possible',
    difficult: 'Difficult',
    available: 'Available',
    busy: 'Busy',
    selectedMembers: 'selected',
    allMembers: 'All Members',
    noneSelected: 'None selected',
    allAvailable: 'All available',
    allBusy: 'All busy',
    busyPrefix: 'Busy',
  },
  calendarSync: {
    // Navigation
    title: 'Calendar Sync',
    // Permissions
    permissions: 'Permissions',
    permissionGranted: 'Access Granted',
    permissionDenied: 'Access Denied',
    permissionDeniedMessage: 'Calendar access is required to use this feature',
    permissionRequired: 'Calendar access required',
    grantPermission: 'Grant Access',
    permissionInstructions: 'Grant calendar access to sync rehearsals',
    checkingPermissions: 'Checking permissions...',
    // Export Settings
    exportSettings: 'Export Settings',
    exportEnabled: 'Export rehearsals',
    exportCalendar: 'Export to calendar',
    selectCalendar: 'Select Calendar',
    targetCalendar: 'Target Calendar',
    noCalendarSelected: 'No calendar selected',
    selectCalendarFirst: 'Please select a calendar first',
    // Actions
    actions: 'Actions',
    exportAll: 'Export All Rehearsals',
    exportAllProgress: (current: number, total: number) => `Exporting ${current} of ${total}...`,
    removeAll: 'Remove All Exported',
    removeAllConfirm: 'Remove all rehearsals from calendar?',
    // Status
    status: 'Status',
    lastSynced: 'Last synced',
    lastSync: 'Last Sync',
    neverSynced: 'Never synced',
    syncedCount: 'Synced Rehearsals',
    never: 'Never',
    syncing: 'Syncing...',
    syncSuccess: 'Synced successfully',
    exportSuccess: 'Exported successfully',
    exportAllSuccess: 'All rehearsals exported',
    removeSuccess: 'Removed successfully',
    removeAllSuccess: 'All rehearsals removed from calendar',
    syncError: 'Sync error',
    exportError: 'Export Error',
    exportErrorMessage: 'Failed to export rehearsals',
    rehearsalsSynced: (count: number) => `${count} rehearsal${count !== 1 ? 's' : ''} synced`,
    // Rehearsal indicators
    syncedToCalendar: 'Added to calendar',
    notSynced: 'Not synced',
    // Errors
    noCalendars: 'No calendars found',
    noCalendarsMessage: 'No calendars available on this device',
    noWritableCalendars: 'No writable calendars',
    exportFailed: 'Export failed',
    deleteFailed: 'Failed to delete from calendar',
  },
  availability: {
    title: 'Availability',
    available: 'Available',
    unavailable: 'Unavailable',
    timeSlots: 'Time slots',
    addSlot: 'Add slot',
    from: 'From',
    to: 'To',
    free: 'Free',
    busy: 'Busy',
    partial: 'Partial',
    legend: 'Legend',
    saving: 'Saving...',
    saved: 'Availability saved',
    saveError: 'Failed to save availability',
    selectDates: 'Select dates',
    busyTime: 'Busy time',
    startTime: 'Start time',
    endTime: 'End time',
    deleteData: 'Delete this date data',
    deleteDataConfirm: 'Delete data?',
    deleteDataMessage: 'Are you sure you want to delete availability data for this past date?',
    pastDateWarning: 'This is a past date. You can delete data, but not edit.',
    cannotSave: 'Cannot save',
    invalidSlot: 'Please fix the time slots and try again.',
    slotsOverlap: 'Slots must not overlap',
    fixSlots: 'Please fix the time slots and try again.',
    understood: 'Understood',
    selectedDates: (count: number) => `Selected dates: ${count}`,
    freeAllDay: 'You are available all day for rehearsals',
    busyAllDay: 'You are unavailable on this day',
  },
  days: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    short: {
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun',
    },
  },
  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
};

export const translations: Record<Language, Translations> = { ru, en };
