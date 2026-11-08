export interface CommonTranslations {
  save: string;
  cancel: string;
  retry: string;
  back: string;
  delete: string;
  close: string;
  today: string;
  loading: string;
  error: string;
  /** A request that got no answer: no network, a timeout (requestErrorMessage, T-228). */
  noConnection: string;
  /** A request the server answered with a 5xx (requestErrorMessage, T-228). */
  serverUnavailable: string;
  success: string;
  /** Lets go of the days picked; nothing on them changes (T-021). */
  deselect: string;
  /** The short notice after a save went through (Toast, T-021). */
  saved: string;
  selectPeriod: string;
  invalidDateRange: string;
  dateRangeTooLong: (maxDays: number) => string;
  from: string;
  to: string;
  done: string;
  yes: string;
  /** Leaving a sheet with unsaved changes: the destructive choice (useLeaveGuard). */
  dontSave: string;
  /** Its title where there is no action sheet (Android). */
  unsavedChanges: string;
}

export interface NavTranslations {
  calendar: string;
  projects: string;
  addRehearsal: string;
  planner: string;
  profile: string;
}

export interface ActionSheetTranslations {
  title: string;
  createRehearsal: string;
  markBusy: string;
  createProject: string;
}

export interface DaysTranslations {
  short: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
}

export const ru = {
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    retry: 'Повторить',
    back: 'Назад',
    delete: 'Удалить',
    close: 'Закрыть',
    today: 'Сегодня',
    loading: 'Загрузка...',
    error: 'Ошибка',
    noConnection: 'Нет соединения. Проверьте интернет и попробуйте ещё раз.',
    serverUnavailable: 'Сервер недоступен. Попробуйте позже.',
    success: 'Успех',
    deselect: 'Снять выбор',
    saved: 'Сохранено',
    selectPeriod: 'Выберите период',
    invalidDateRange: 'Выберите корректные даты начала и окончания.',
    dateRangeTooLong: (maxDays: number) => `Выберите период не длиннее ${maxDays} дней, включая первый и последний день.`,
    from: 'От:',
    to: 'До:',
    done: 'Готово',
    yes: 'Да',
    dontSave: 'Не сохранять',
    unsavedChanges: 'Изменения не сохранены',
  },
  nav: {
    calendar: 'Календарь',
    projects: 'Проекты',
    addRehearsal: '',
    planner: 'Планер',
    profile: 'Профиль',
  },
  actionSheet: {
    title: 'Новое действие',
    createRehearsal: 'Создать репетицию',
    markBusy: 'Отметить занятость',
    createProject: 'Создать проект',
  },
  days: {
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
};

export const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    retry: 'Try again',
    back: 'Back',
    delete: 'Delete',
    close: 'Close',
    today: 'Today',
    loading: 'Loading...',
    error: 'Error',
    noConnection: 'No connection. Check the internet and try again.',
    serverUnavailable: 'The server is unavailable. Try again later.',
    success: 'Success',
    deselect: 'Deselect',
    saved: 'Saved',
    selectPeriod: 'Select Period',
    invalidDateRange: 'Choose valid start and end dates.',
    dateRangeTooLong: (maxDays: number) => `Choose a range of up to ${maxDays} days, including the first and last day.`,
    from: 'From:',
    to: 'To:',
    done: 'Done',
    yes: 'Yes',
    dontSave: "Don't Save",
    unsavedChanges: 'Unsaved changes',
  },
  nav: {
    calendar: 'Calendar',
    projects: 'Projects',
    addRehearsal: '',
    planner: 'Planner',
    profile: 'Profile',
  },
  actionSheet: {
    title: 'New Action',
    createRehearsal: 'Create Rehearsal',
    markBusy: 'Mark Busy',
    createProject: 'Create Project',
  },
  days: {
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
};

export const es = {
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    retry: 'Reintentar',
    back: 'Atrás',
    delete: 'Eliminar',
    close: 'Cerrar',
    today: 'Hoy',
    loading: 'Cargando...',
    error: 'Error',
    noConnection: 'Sin conexión. Revisa internet e inténtalo de nuevo.',
    serverUnavailable: 'El servidor no está disponible. Inténtalo más tarde.',
    success: 'Éxito',
    deselect: 'Quitar selección',
    saved: 'Guardado',
    selectPeriod: 'Seleccionar período',
    invalidDateRange: 'Elige fechas de inicio y fin válidas.',
    dateRangeTooLong: (maxDays: number) => `Elige un período de hasta ${maxDays} días, incluidos el primero y el último.`,
    from: 'Desde:',
    to: 'Hasta:',
    done: 'Listo',
    yes: 'Sí',
    dontSave: 'No guardar',
    unsavedChanges: 'Cambios sin guardar',
  },
  nav: {
    calendar: 'Calendario',
    projects: 'Proyectos',
    addRehearsal: '',
    planner: 'Planificador',
    profile: 'Perfil',
  },
  actionSheet: {
    title: 'Nueva acción',
    createRehearsal: 'Crear ensayo',
    markBusy: 'Marcar ocupado',
    createProject: 'Crear proyecto',
  },
  days: {
    short: {
      monday: 'Lun',
      tuesday: 'Mar',
      wednesday: 'Mié',
      thursday: 'Jue',
      friday: 'Vie',
      saturday: 'Sáb',
      sunday: 'Dom',
    },
  },
};

export const de = {
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    retry: 'Erneut versuchen',
    back: 'Zurück',
    delete: 'Löschen',
    close: 'Schließen',
    today: 'Heute',
    loading: 'Wird geladen...',
    error: 'Fehler',
    noConnection: 'Keine Verbindung. Prüfe das Internet und versuche es erneut.',
    serverUnavailable: 'Der Server ist nicht erreichbar. Versuche es später erneut.',
    success: 'Erfolg',
    deselect: 'Auswahl aufheben',
    saved: 'Gespeichert',
    selectPeriod: 'Zeitraum auswählen',
    invalidDateRange: 'Wähle gültige Start- und Enddaten.',
    dateRangeTooLong: (maxDays: number) => `Wähle einen Zeitraum von höchstens ${maxDays} Tagen, einschließlich des ersten und letzten Tages.`,
    from: 'Von:',
    to: 'Bis:',
    done: 'Fertig',
    yes: 'Ja',
    dontSave: 'Nicht sichern',
    unsavedChanges: 'Nicht gesicherte Änderungen',
  },
  nav: {
    calendar: 'Kalender',
    projects: 'Projekte',
    addRehearsal: '',
    planner: 'Planer',
    profile: 'Profil',
  },
  actionSheet: {
    title: 'Neue Aktion',
    createRehearsal: 'Probe erstellen',
    markBusy: 'Als beschäftigt markieren',
    createProject: 'Projekt erstellen',
  },
  days: {
    short: {
      monday: 'Mo',
      tuesday: 'Di',
      wednesday: 'Mi',
      thursday: 'Do',
      friday: 'Fr',
      saturday: 'Sa',
      sunday: 'So',
    },
  },
};
