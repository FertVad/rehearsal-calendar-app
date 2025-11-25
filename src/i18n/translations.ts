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
  };
  // Navigation
  nav: {
    calendar: string;
    projects: string;
    addRehearsal: string;
    profile: string;
  };
  // Calendar
  calendar: {
    title: string;
    rehearsalsFor: string;
    noRehearsals: string;
    selectProject: string;
  };
  // Projects
  projects: {
    title: string;
    noProjects: string;
    createFirst: string;
    admin: string;
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
    myRehearsals: string;
    upcoming: string;
    noUpcoming: string;
    willAppear: string;
    scene: string;
    date: string;
    time: string;
    duration: string;
    notes: string;
    actors: string;
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
  },
  nav: {
    calendar: 'Календарь',
    projects: 'Мои проекты',
    addRehearsal: 'Добавить',
    profile: 'Профиль',
  },
  calendar: {
    title: 'Календарь репетиций',
    rehearsalsFor: 'Репетиции на',
    noRehearsals: 'Нет репетиций на этот день',
    selectProject: 'Выберите проект в разделе "Проекты"',
  },
  projects: {
    title: 'Мои проекты',
    noProjects: 'Нет проектов',
    createFirst: 'Создайте свой первый проект, чтобы начать работу',
    admin: 'Админ',
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
    myRehearsals: 'Мои репетиции',
    upcoming: 'Предстоящие',
    noUpcoming: 'Нет предстоящих репетиций',
    willAppear: 'Ваши репетиции появятся здесь, когда они будут запланированы',
    scene: 'Сцена',
    date: 'Дата',
    time: 'Время',
    duration: 'Длительность',
    notes: 'Заметки',
    actors: 'Актёры',
  },
  availability: {
    title: 'Моя доступность',
    available: 'Доступен',
    unavailable: 'Недоступен',
    timeSlots: 'Временные слоты',
    addSlot: 'Добавить слот',
    from: 'С',
    to: 'До',
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
  },
  nav: {
    calendar: 'Calendar',
    projects: 'My Projects',
    addRehearsal: 'Add',
    profile: 'Profile',
  },
  calendar: {
    title: 'Rehearsal Calendar',
    rehearsalsFor: 'Rehearsals for',
    noRehearsals: 'No rehearsals for this day',
    selectProject: 'Select a project in "Projects" section',
  },
  projects: {
    title: 'My Projects',
    noProjects: 'No projects',
    createFirst: 'Create your first project to get started',
    admin: 'Admin',
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
    myRehearsals: 'My Rehearsals',
    upcoming: 'Upcoming',
    noUpcoming: 'No upcoming rehearsals',
    willAppear: 'Your rehearsals will appear here when they are scheduled',
    scene: 'Scene',
    date: 'Date',
    time: 'Time',
    duration: 'Duration',
    notes: 'Notes',
    actors: 'Actors',
  },
  availability: {
    title: 'My Availability',
    available: 'Available',
    unavailable: 'Unavailable',
    timeSlots: 'Time slots',
    addSlot: 'Add slot',
    from: 'From',
    to: 'To',
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
