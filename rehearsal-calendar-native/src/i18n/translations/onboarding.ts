export interface OnboardingTranslations {
  skipTitle: string;
  skipMessage: string;
  /** The step's "Skip" at the top. There is no "Next": a step goes on by its answers (T-412). */
  skip: string;
  welcome: {
    feature1: string;
    feature2: string;
    feature3: string;
    /** One line, the name in it: "Welcome, Nina!" (T-022). */
    greeting: (firstName?: string) => string;
    /** In lines by their sense, each a native speaker's (T-412). */
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
    /** Three lines, the days on one of their own (T-412). */
    question: (days: string) => string;
    description: string;
    note: (path: string) => string;
    yes: string;
    no: string;
  };
  calendarSync: {
    /** Names the step for what it is, calendar sync (T-412); up to two lines. */
    title: string;
    /** Both ways of the sync, and the privacy promise said here and only here. */
    description: string;
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

/**
 * Where iOS may break these lines is each native speaker's (T-417): "\u00a0"
 * keeps a group of words by its sense on one line, "\n" breaks where the
 * speaker broke. In "What's Where" a label of the app goes whole — its plain
 * spaces no-break — where the language's speaker said so; on its button it
 * stays as it is.
 */
// String(): as a template takes whatever it is given (the checks pass samples).
const whole = (label: string): string => String(label).replace(/ /g, '\u00a0');

export const ru = {
  onboarding: {
    skipTitle: 'Настройки доступны в\u00a0профиле',
    skipMessage: 'Начало недели, синхронизацию\u00a0календаря и\u00a0то, отмечать\u00a0ли выходные\u00a0занятыми, можно\u00a0настроить в\u00a0любое\u00a0время: Профиль\u00a0→\u00a0Настройки.',
    skip: 'Пропустить',
    welcome: {
      feature1: 'Все отмечают, когда заняты',
      feature2: 'Rehearsly находит\u00a0время, когда\u00a0свободны\u00a0все',
      feature3: 'Репетиция уходит всем в календарь',
      greeting: (firstName?: string) => (firstName ? `Добро пожаловать, ${firstName}!` : 'Добро пожаловать!'),
      description: 'Планируйте репетиции,\nуправляйте расписанием\nи синхронизируйте календари\nв одном месте.',
      next: 'Начать',
    },
    notifications: {
      title: 'Уведомления',
      description: 'Новая репетиция, отменили или перенесли —\nвы узнаете сразу.',
      allow: 'Включить',
      later: 'Не сейчас',
      exampleAdded: 'Вас позвали на репетицию',
      exampleTimeChanged: 'Время репетиции изменилось',
    },
    weekends: {
      question: (days: string) => `Отметить все выходные\n(${days})\nкак занятые?`,
      description: 'Тогда при подборе времени\nваши выходные будут считаться занятыми.\nЛюбой выходной можно отметить иначе\nв «Занятости».',
      note: (path: string) => `Это можно включить\u00a0или\u00a0выключить позже: ${path}`,
      yes: 'Да, отметить',
      no: 'Нет, оставить свободными',
    },
    calendarSync: {
      title: 'Синхронизация календаря',
      description: 'Репетиции сами попадут в ваш календарь,\nа занятые часы из него — в Rehearsly.\nКоманда видит только эти часы,\nно не ваши дела.',
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
        // "Присоединиться по коду" is not whole: at a large size the path would
        // break before "коду", one word on the last line (T-417).
        `«+»\u00a0→\u00a0«${whole(create)}». По\u00a0приглашению: «${projects}»\u00a0→\u00a0«${join}»`,
      rehearsal: 'Репетиция',
      rehearsalWhere: (create: string) => `«+»\u00a0→\u00a0«${whole(create)}»,\nв\u00a0проектах, где\u00a0вы\u00a0администратор`,
      availability: 'Занятость',
      availabilityWhere: (mark: string) => `«+» → «${whole(mark)}»`,
      planner: 'Подбор времени',
      plannerWhere: (planner: string) => `«${whole(planner)}» под календарём`,
      start: 'Начать',
    },
  },
};

export const en = {
  onboarding: {
    // A sentence, so sentence case and its full stop (HIG, Alerts; T-417).
    skipTitle: 'Settings are in\u00a0your\u00a0profile.',
    skipMessage: 'You can choose the\u00a0first\u00a0day of\u00a0the\u00a0week, decide whether your\u00a0weekends are\u00a0marked\u00a0as\u00a0busy, and set\u00a0up calendar\u00a0sync at\u00a0any\u00a0time in\u00a0Profile\u00a0→\u00a0Settings.',
    skip: 'Skip',
    welcome: {
      feature1: 'Everyone marks when\u00a0they\u00a0are\u00a0busy',
      feature2: 'Rehearsly finds the\u00a0hours that\u00a0suit\u00a0all\u00a0of\u00a0you',
      feature3: 'The rehearsal lands in\u00a0everyone’s\u00a0calendar',
      greeting: (firstName?: string) => (firstName ? `Welcome, ${firstName}!` : 'Welcome!'),
      description: 'Plan rehearsals, manage schedules,\nand sync calendars in one place.',
      next: 'Get Started',
    },
    notifications: {
      title: 'Notifications',
      description: 'A new rehearsal, a new time, or a cancellation —\nyou’ll know right away.',
      allow: 'Turn On',
      later: 'Not Now',
      exampleAdded: 'You Were Added to\u00a0a\u00a0Rehearsal',
      exampleTimeChanged: 'Rehearsal Time Changed',
    },
    weekends: {
      question: (days: string) => `Mark all weekends\n(${days})\nas busy?`,
      description: 'When someone looks for a rehearsal time,\nthey will see you as busy on those days.\nYou can still change any individual day\nin Availability.',
      note: (path: string) => `You can turn this on or off later in\u00a0${path}`,
      yes: 'Yes, Mark Them',
      no: 'No, Leave Them Free',
    },
    calendarSync: {
      title: 'Calendar Sync',
      description: 'Rehearsals appear in your calendar automatically,\nand Rehearsly picks up your busy hours from\u00a0it.\nYour team sees only those hours,\nnot what you’re doing.',
      google: 'Google Calendar',
      apple: 'Apple Calendar',
      setupLater: 'Set Up Later',
      laterWhere: (path: string) => `You can do it later in\u00a0${path}`,
      noCalendars: 'No calendars found',
      settingUp: 'Setting up calendar sync…',
      permissionRequired: 'Permission Required',
      grantPermission: 'Grant Access',
    },
    whatWhere: {
      title: 'What’s Where',
      project: 'Project',
      projectWhere: (create: string, projects: string, join: string) =>
        `“+”\u00a0→\u00a0“${whole(create)}”.\nInvited? “${projects}”\u00a0→\u00a0“${whole(join)}”`,
      rehearsal: 'Rehearsal',
      rehearsalWhere: (create: string) => `“+”\u00a0→\u00a0“${whole(create)}”,\nin\u00a0projects where\u00a0you\u00a0are\u00a0an\u00a0admin`,
      availability: 'Availability',
      availabilityWhere: (mark: string) => `“+” → “${whole(mark)}”`,
      planner: 'Finding a Time',
      plannerWhere: (planner: string) => `“${whole(planner)}”, under\u00a0the\u00a0calendar`,
      start: 'Get Started',
    },
  },
};

export const es = {
  onboarding: {
    skipTitle: 'Ajustes disponibles en\u00a0el\u00a0perfil',
    skipMessage: 'Puedes elegir el\u00a0inicio de\u00a0la\u00a0semana, decidir si\u00a0tus\u00a0fines\u00a0de\u00a0semana se\u00a0marcan como\u00a0ocupados y\u00a0configurar la\u00a0sincronización del\u00a0calendario cuando\u00a0quieras en\u00a0Perfil\u00a0→\u00a0Ajustes.',
    skip: 'Omitir',
    welcome: {
      feature1: 'Cada uno marca sus\u00a0horas\u00a0ocupadas',
      feature2: 'Rehearsly encuentra las\u00a0horas que\u00a0les\u00a0sirven\u00a0a\u00a0todos',
      feature3: 'El ensayo llega al\u00a0calendario\u00a0de\u00a0cada\u00a0uno',
      // "Bienvenido" is a man's; "te damos la bienvenida" is anyone's.
      greeting: (firstName?: string) => (firstName ? `¡Te damos la bienvenida, ${firstName}!` : '¡Te damos la bienvenida!'),
      description: 'Planifica ensayos, gestiona horarios\ny sincroniza calendarios en un solo lugar.',
      next: 'Empezar',
    },
    notifications: {
      title: 'Notificaciones',
      description: 'Ensayo nuevo, cancelado o reprogramado:\nte enterarás al instante.',
      allow: 'Activar',
      later: 'Ahora no',
      exampleAdded: 'Te han añadido a un ensayo',
      exampleTimeChanged: 'Cambió la hora de un ensayo',
    },
    weekends: {
      question: (days: string) => `¿Marcar como ocupados\ntodos los fines de semana\n(${days})?`,
      description: 'Así, cuando alguien busque un horario,\ntus fines de semana contarán como ocupados.\nPuedes cambiar cualquier día\npor separado en Disponibilidad.',
      note: (path: string) => `Puedes activarlo o\u00a0desactivarlo más\u00a0tarde en\u00a0${path}`,
      yes: 'Sí, marcarlos',
      no: 'No, dejarlos libres',
    },
    calendarSync: {
      title: 'Sincronización del\u00a0calendario',
      description: 'Los ensayos aparecerán solos en tu calendario,\ny de él llegarán a Rehearsly tus horas ocupadas.\nEl equipo ve solo esas horas, no tus planes.',
      google: 'Google Calendar',
      apple: 'Apple Calendar',
      setupLater: 'Configurar más tarde',
      laterWhere: (path: string) => `Puedes hacerlo después en\u00a0${path}`,
      noCalendars: 'No se encontraron calendarios',
      settingUp: 'Configurando la sincronización…',
      permissionRequired: 'Permiso requerido',
      grantPermission: 'Conceder acceso',
    },
    whatWhere: {
      title: 'Dónde está cada cosa',
      project: 'Proyecto',
      projectWhere: (create: string, projects: string, join: string) =>
        `«+»\u00a0→\u00a0«${whole(create)}». Con\u00a0una\u00a0invitación: «${projects}»\u00a0→\u00a0«${whole(join)}»`,
      rehearsal: 'Ensayo',
      rehearsalWhere: (create: string) => `«+»\u00a0→\u00a0«${whole(create)}», en\u00a0los\u00a0proyectos\u00a0que\u00a0administras`,
      availability: 'Disponibilidad',
      availabilityWhere: (mark: string) => `«+» → «${whole(mark)}»`,
      planner: 'Buscar un horario',
      plannerWhere: (planner: string) => `«${whole(planner)}», debajo\u00a0del\u00a0calendario`,
      start: 'Empezar',
    },
  },
};

export const de = {
  onboarding: {
    skipTitle: 'Einstellungen im\u00a0Profil\u00a0verfügbar',
    skipMessage: 'Du kannst jederzeit den\u00a0Wochenbeginn\u00a0ändern, die\u00a0Kalendersynchronisation einrichten und festlegen, ob\u00a0deine\u00a0Wochenenden als\u00a0belegt\u00a0gelten\u00a0– alles\u00a0unter\u00a0Profil\u00a0→\u00a0Einstellungen.',
    skip: 'Überspringen',
    welcome: {
      feature1: 'Alle tragen ein, wann\u00a0sie\u00a0beschäftigt\u00a0sind',
      feature2: 'Rehearsly findet die\u00a0Stunden, die\u00a0allen\u00a0passen',
      feature3: 'Die Probe landet bei\u00a0allen\u00a0im\u00a0Kalender',
      greeting: (firstName?: string) => (firstName ? `Willkommen, ${firstName}!` : 'Willkommen!'),
      description: 'Plane Proben, verwalte Termine\nund synchronisiere Kalender an einem Ort.',
      next: 'Loslegen',
    },
    notifications: {
      title: 'Mitteilungen',
      description: 'Neue Probe, Absage oder Verschiebung\u00a0–\ndu erfährst es sofort.',
      allow: 'Einschalten',
      later: 'Jetzt nicht',
      exampleAdded: 'Du wurdest für\u00a0eine\u00a0Probe\u00a0eingeteilt',
      exampleTimeChanged: 'Die Zeit einer Probe hat\u00a0sich\u00a0geändert',
    },
    weekends: {
      question: (days: string) => `Alle Wochenenden\n(${days})\nals belegt markieren?`,
      description: 'Dann gelten deine Wochenenden\nbei der Terminsuche als belegt.\nEinzelne Tage kannst du\nunter Verfügbarkeit ändern.',
      // None in "Ein- und": iOS breaks after the hyphen anyway, and it would begin the line.
      note: (path: string) => `Ein- und ausschalten kannst\u00a0du\u00a0das\u00a0später unter\u00a0${path}`,
      yes: 'Ja, markieren',
      no: 'Nein, nicht markieren',
    },
    calendarSync: {
      title: 'Kalender-Sync',
      description: 'Proben landen von selbst in deinem Kalender,\nbelegte Zeiten von dort in Rehearsly.\nDie anderen im Projekt sehen nur diese Zeiten,\naber nicht, was du vorhast.',
      google: 'Google Kalender',
      apple: 'Apple Kalender',
      setupLater: 'Später einrichten',
      laterWhere: (path: string) => `Das geht auch später unter\u00a0${path}`,
      noCalendars: 'Keine Kalender gefunden',
      settingUp: 'Kalendersynchronisation wird eingerichtet\u00a0…',
      permissionRequired: 'Berechtigung erforderlich',
      grantPermission: 'Zugriff gewähren',
    },
    whatWhere: {
      title: 'Wo ist was?',
      project: 'Projekt',
      projectWhere: (create: string, projects: string, join: string) =>
        // No no-break space after an arrow: each path begins its line, and a
        // path too long for one breaks best right after its arrow (T-417).
        `„+“\u00a0→ „${whole(create)}“. Per\u00a0Einladung:\n„${projects}“\u00a0→ „${whole(join)}“`,
      rehearsal: 'Probe',
      rehearsalWhere: (create: string) => `„+“\u00a0→ „${whole(create)}“, in\u00a0Projekten, in\u00a0denen\u00a0du\u00a0Admin\u00a0bist`,
      availability: 'Verfügbarkeit',
      availabilityWhere: (mark: string) => `„+“ → „${whole(mark)}“`,
      planner: 'Zeit finden',
      plannerWhere: (planner: string) => `„${whole(planner)}“ unter\u00a0dem\u00a0Kalender`,
      start: 'Loslegen',
    },
  },
};
