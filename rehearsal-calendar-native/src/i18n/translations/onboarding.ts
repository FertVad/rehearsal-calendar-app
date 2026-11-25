export interface OnboardingTranslations {
  skipTitle: string;
  skipMessage: string;
  /** The step's "Skip" at the top, and its forward button unless it names its own. */
  skip: string;
  next: string;
  welcome: {
    feature1: string;
    feature2: string;
    feature3: string;
    /** One line, the name in it: "Welcome, Nina!" (T-022). */
    greeting: (firstName?: string) => string;
    description: string;
    next: string;
  };
  notifications: {
    title: string;
    description: string;
    allow: string;
    later: string;
    /** Examples of what a notification says. */
    exampleAdded: string;
    exampleTimeChanged: string;
  };
  /**
   * The step after the greeting (T-406): weekends busy by default, asked
   * outright with the days of the profile's zone; the answer is the
   * profile's switch. `note` names where it is turned on and off later,
   * the path as the Profile labels it.
   */
  weekends: {
    question: (days: string) => string;
    description: string;
    note: (path: string) => string;
    yes: string;
    no: string;
  };
  calendarSync: {
    title: string;
    /** Two sentences; the privacy promise is said here and only here. */
    description: string;
    next: string;
    google: string;
    apple: string;
    setupLater: string;
    /** Under "Set up later": where it is set up then, the path as the Profile labels it. */
    laterWhere: (path: string) => string;
    noCalendars: string;
    settingUp: string;
    permissionRequired: string;
    grantPermission: string;
  };
  /**
   * The last step: where things are. Each place is given in the labels the
   * app itself shows there, passed in, so the step cannot drift from it.
   */
  whatWhere: {
    title: string;
    project: string;
    projectWhere: (create: string, projects: string, join: string) => string;
    rehearsal: string;
    rehearsalWhere: (create: string) => string;
    availability: string;
    availabilityWhere: (mark: string) => string;
    planner: string;
    plannerWhere: (planner: string) => string;
    start: string;
  };
}

export const ru = {
  onboarding: {
    skipTitle: 'Настройки доступны в профиле',
    skipMessage: 'Начало недели, синхронизацию календаря и то, отмечать ли выходные занятыми, можно настроить в любое время: Профиль → Настройки.',
    skip: 'Пропустить',
    next: 'Далее',
    welcome: {
      feature1: 'Все отмечают, когда заняты',
      feature2: 'Rehearsly находит время, когда свободны все',
      feature3: 'Репетиция уходит всем в календарь',
      greeting: (firstName?: string) => (firstName ? `Добро пожаловать, ${firstName}!` : 'Добро пожаловать!'),
      description: 'Планируйте репетиции, управляйте расписанием и синхронизируйте календари в одном месте',
      next: 'Начать',
    },
    notifications: {
      title: 'Уведомления',
      description: 'Придёт уведомление, когда вас позовут на репетицию или изменят её время. Без уведомлений легко узнать об изменениях позже всех.',
      allow: 'Включить',
      later: 'Не сейчас',
      exampleAdded: 'Вас позвали на репетицию',
      exampleTimeChanged: 'Время репетиции изменилось',
    },
    // T-406: new, for the native speakers' reading.
    weekends: {
      question: (days: string) => `Отметить все выходные (${days}) как занятые?`,
      description: 'Тогда при подборе времени ваши выходные будут считаться занятыми. Любой выходной можно отметить иначе в «Занятости».',
      note: (path: string) => `Это можно включить или выключить позже: ${path}`,
      yes: 'Да, отметить',
      no: 'Нет, оставить свободными',
    },
    calendarSync: {
      title: 'Ваша занятость',
      description: 'Команда видит только часы, когда вы заняты, но не ваши дела. Выберите календарь телефона — и эти часы будут подтягиваться сами.',
      next: 'Далее',
      google: 'Google Календарь',
      apple: 'Календарь iPhone',
      setupLater: 'Настроить позже',
      laterWhere: (path: string) => `Это можно сделать потом: ${path}`,
      noCalendars: 'Календари не найдены',
      settingUp: 'Подключаем календарь…',
      permissionRequired: 'Требуется разрешение',
      grantPermission: 'Разрешить доступ',
    },
    whatWhere: {
      title: 'Что где',
      project: 'Проект',
      projectWhere: (create: string, projects: string, join: string) =>
        // Not "По коду: … «Присоединиться по коду»", the code twice (T-258).
        `«+» → «${create}». По приглашению: «${projects}» → «${join}»`,
      rehearsal: 'Репетиция',
      rehearsalWhere: (create: string) => `«+» → «${create}», в проектах, где вы администратор`,
      availability: 'Занятость',
      availabilityWhere: (mark: string) => `«+» → «${mark}»`,
      planner: 'Подбор времени',
      plannerWhere: (planner: string) => `«${planner}» под календарём`,
      start: 'Начать',
    },
  },
};

export const en = {
  onboarding: {
    skipTitle: 'Settings Are in Your Profile',
    skipMessage: 'You can choose the first day of the week, decide whether your weekends are marked as busy, and set up calendar sync at any time in Profile → Settings.',
    skip: 'Skip',
    next: 'Next',
    welcome: {
      feature1: 'Everyone marks when they are busy',
      feature2: 'Rehearsly finds the hours that suit all of you',
      feature3: 'The rehearsal lands in everyone’s calendar',
      greeting: (firstName?: string) => (firstName ? `Welcome, ${firstName}!` : 'Welcome!'),
      description: 'Plan rehearsals, manage schedules, and sync calendars in one place',
      next: 'Get Started',
    },
    notifications: {
      title: 'Notifications',
      description: 'You will hear when someone puts you on a rehearsal or its time changes. Without notifications, you may be the last to know.',
      allow: 'Turn On',
      later: 'Not Now',
      exampleAdded: 'You Were Added to a Rehearsal',
      exampleTimeChanged: 'Rehearsal Time Changed',
    },
    // T-406: new, for the native speakers' reading.
    weekends: {
      question: (days: string) => `Mark all weekends (${days}) as busy?`,
      description: 'When someone looks for a rehearsal time, they will see you as busy on those days. You can still change any individual day in Availability.',
      note: (path: string) => `You can turn this on or off later in ${path}`,
      yes: 'Yes, Mark Them',
      no: 'No, Leave Them Free',
    },
    calendarSync: {
      title: 'Your Availability',
      description: 'Your team sees only the hours you are busy, never what you are doing. Pick a calendar on your phone, and those hours will be added automatically.',
      next: 'Next',
      google: 'Google Calendar',
      apple: 'Apple Calendar',
      setupLater: 'Set Up Later',
      laterWhere: (path: string) => `You can do it later in ${path}`,
      noCalendars: 'No calendars found',
      settingUp: 'Setting up calendar sync…',
      permissionRequired: 'Permission Required',
      grantPermission: 'Grant Access',
    },
    whatWhere: {
      title: 'What’s Where',
      project: 'Project',
      projectWhere: (create: string, projects: string, join: string) =>
        `“+” → “${create}”. Invited? “${projects}” → “${join}”`,
      rehearsal: 'Rehearsal',
      rehearsalWhere: (create: string) => `“+” → “${create}”, in projects where you are an admin`,
      availability: 'Availability',
      availabilityWhere: (mark: string) => `“+” → “${mark}”`,
      planner: 'Finding a Time',
      plannerWhere: (planner: string) => `“${planner}”, under the calendar`,
      start: 'Get Started',
    },
  },
};

export const es = {
  onboarding: {
    skipTitle: 'Ajustes disponibles en el perfil',
    skipMessage: 'Puedes elegir el inicio de la semana, decidir si tus fines de semana se marcan como ocupados y configurar la sincronización del calendario cuando quieras en Perfil → Ajustes.',
    skip: 'Omitir',
    next: 'Siguiente',
    welcome: {
      feature1: 'Cada uno marca sus horas ocupadas',
      feature2: 'Rehearsly encuentra las horas que les sirven a todos',
      feature3: 'El ensayo llega al calendario de cada uno',
      // "Bienvenido" is a man's; "te damos la bienvenida" is anyone's.
      greeting: (firstName?: string) => (firstName ? `¡Te damos la bienvenida, ${firstName}!` : '¡Te damos la bienvenida!'),
      description: 'Planifica ensayos, gestiona horarios y sincroniza calendarios en un solo lugar',
      next: 'Empezar',
    },
    notifications: {
      title: 'Notificaciones',
      description: 'Te avisamos cuando alguien te ponga en un ensayo y cuando cambie su hora. Sin ellas, te enterarás tarde.',
      allow: 'Activar',
      later: 'Ahora no',
      exampleAdded: 'Te han añadido a un ensayo',
      exampleTimeChanged: 'Cambió la hora de un ensayo',
    },
    // T-406: new, for the native speakers' reading.
    weekends: {
      question: (days: string) => `¿Marcar todos los fines de semana (${days}) como ocupados?`,
      description: 'Así, cuando alguien busque un horario, tus fines de semana contarán como ocupados. Puedes cambiar cualquier día por separado en Disponibilidad.',
      note: (path: string) => `Puedes activarlo o desactivarlo más tarde en ${path}`,
      yes: 'Sí, marcarlos',
      no: 'No, dejarlos libres',
    },
    calendarSync: {
      title: 'Tu disponibilidad',
      description: 'El equipo ve solo las horas en que no puedes, nunca qué estás haciendo. Elige un calendario del teléfono y esas horas llegarán solas.',
      next: 'Siguiente',
      google: 'Google Calendar',
      apple: 'Apple Calendar',
      setupLater: 'Configurar más tarde',
      laterWhere: (path: string) => `Puedes hacerlo después en ${path}`,
      noCalendars: 'No se encontraron calendarios',
      settingUp: 'Configurando la sincronización…',
      permissionRequired: 'Permiso requerido',
      grantPermission: 'Conceder acceso',
    },
    whatWhere: {
      title: 'Dónde está cada cosa',
      project: 'Proyecto',
      projectWhere: (create: string, projects: string, join: string) =>
        `«+» → «${create}». Con una invitación: «${projects}» → «${join}»`,
      rehearsal: 'Ensayo',
      rehearsalWhere: (create: string) => `«+» → «${create}», en los proyectos que administras`,
      availability: 'Disponibilidad',
      availabilityWhere: (mark: string) => `«+» → «${mark}»`,
      planner: 'Buscar un horario',
      plannerWhere: (planner: string) => `«${planner}», debajo del calendario`,
      start: 'Empezar',
    },
  },
};

export const de = {
  onboarding: {
    skipTitle: 'Einstellungen im Profil verfügbar',
    skipMessage: 'Du kannst jederzeit den Wochenbeginn ändern, die Kalendersynchronisation einrichten und festlegen, ob deine Wochenenden als belegt gelten – alles unter Profil → Einstellungen.',
    skip: 'Überspringen',
    next: 'Weiter',
    welcome: {
      feature1: 'Alle tragen ein, wann sie beschäftigt sind',
      feature2: 'Rehearsly findet die Stunden, die allen passen',
      feature3: 'Die Probe landet bei allen im Kalender',
      greeting: (firstName?: string) => (firstName ? `Willkommen, ${firstName}!` : 'Willkommen!'),
      description: 'Plane Proben, verwalte Termine und synchronisiere Kalender an einem Ort',
      next: 'Loslegen',
    },
    notifications: {
      title: 'Mitteilungen',
      description: 'Du erfährst es, wenn dich jemand für eine Probe einteilt und wenn sich ihre Zeit ändert. Ohne Mitteilungen erfährst du es zuletzt.',
      allow: 'Einschalten',
      later: 'Jetzt nicht',
      exampleAdded: 'Du wurdest für eine Probe eingeteilt',
      exampleTimeChanged: 'Die Zeit einer Probe hat sich geändert',
    },
    // T-406: new, for the native speakers' reading.
    weekends: {
      question: (days: string) => `Alle Wochenenden (${days}) als belegt markieren?`,
      description: 'Dann gelten deine Wochenenden bei der Terminsuche als belegt. Einzelne Tage kannst du unter Verfügbarkeit ändern.',
      note: (path: string) => `Ein- und ausschalten kannst du das später unter ${path}`,
      yes: 'Ja, markieren',
      no: 'Nein, nicht markieren',
    },
    calendarSync: {
      title: 'Deine Verfügbarkeit',
      description: 'Die anderen im Projekt sehen nur, wann du beschäftigt bist – nie, womit. Wähle einen deiner Kalender aus, dann kommen diese Zeiten von selbst herüber.',
      next: 'Weiter',
      google: 'Google Kalender',
      apple: 'Apple Kalender',
      setupLater: 'Später einrichten',
      laterWhere: (path: string) => `Das geht auch später unter ${path}`,
      noCalendars: 'Keine Kalender gefunden',
      settingUp: 'Kalendersynchronisation wird eingerichtet …',
      permissionRequired: 'Berechtigung erforderlich',
      grantPermission: 'Zugriff gewähren',
    },
    whatWhere: {
      title: 'Wo ist was?',
      project: 'Projekt',
      projectWhere: (create: string, projects: string, join: string) =>
        `„+“ → „${create}“. Per Einladung: „${projects}“ → „${join}“`,
      rehearsal: 'Probe',
      rehearsalWhere: (create: string) => `„+“ → „${create}“, in Projekten, in denen du Admin bist`,
      availability: 'Verfügbarkeit',
      availabilityWhere: (mark: string) => `„+“ → „${mark}“`,
      planner: 'Zeit finden',
      plannerWhere: (planner: string) => `„${planner}“ unter dem Kalender`,
      start: 'Loslegen',
    },
  },
};
