export interface OnboardingTranslations {
  skipTitle: string;
  skipMessage: string;
  welcome: {
    feature1: string;
    feature2: string;
    feature3: string;
    title: string;
    subtitle: string;
    description: string;
    next: string;
    skip: string;
  };
  weekStart: {
    title: string;
    description: string;
    monday: string;
    sunday: string;
    next: string;
    back: string;
    skip: string;
  };
  notifications: {
    title: string;
    description: string;
    allow: string;
    later: string;
    back: string;
    skip: string;
  };
  calendarSync: {
    title: string;
    description: string;
    privacy: string;
    pickCalendar: string;
    connectedTitle: string;
    connectedBody: string;
    manualBody: string;
    next: string;
    google: string;
    apple: string;
    setupLater: string;
    finish: string;
    finishWithoutSync: string;
    back: string;
    permissionRequired: string;
    grantPermission: string;
  };
}

export const ru = {
  onboarding: {
    skipTitle: 'Настройки доступны в профиле',
    skipMessage: 'Вы сможете настроить день начала недели и синхронизацию календаря в любое время в разделе Профиль → Настройки',
    welcome: {
feature1: 'Все отмечают, когда заняты',
feature2: 'Rehearsly находит время, когда свободны все',
feature3: 'Репетиция уходит всем в календарь',
      title: 'Добро пожаловать!',
      subtitle: 'Rehearsly',
      description: 'Планируйте репетиции, управляйте расписанием и синхронизируйте календари в одном месте',
      next: 'Начать',
      skip: 'Пропустить',
    },
    weekStart: {
      title: 'День начала недели',
      description: 'С какого дня у вас начинается неделя?',
      monday: 'Понедельник',
      sunday: 'Воскресенье',
      next: 'Далее',
      back: 'Назад',
      skip: 'Пропустить',
    },
    notifications: {
      title: 'Уведомления',
      description: 'Придёт сообщение, когда вас позовут на репетицию или когда её время изменится. Без них об изменении легко узнать последним.',
      allow: 'Включить',
      later: 'Не сейчас',
      back: 'Назад',
      skip: 'Пропустить',
    },
    calendarSync: {
pickCalendar: 'Выберите календарь — занятость перенесётся из него в приложение',
      privacy: 'Мы читаем только занятые временные слоты. Что это за события, приложение не видит и никому не показывает. Репетиции уходят обратно в ваш календарь.',
      connectedTitle: 'Календарь подключён',
      connectedBody: 'Занятые часы будут подтягиваться сами. Если календарь покрывает не всё — отметьте остальное в приложении, на экране «Занятость».',
      manualBody: 'Отмечайте занятость на экране «Занятость». Пока вы этого не сделали, вас считают свободным.',
      title: 'Ваша занятость',
      description: 'Команда видит не ваши дела, а только часы, когда вас нет. Занятость можно подтянуть из календаря телефона — тогда отмечать руками почти не придётся.',
      next: 'Далее',
      google: 'Google Calendar',
      apple: 'Apple Calendar',
      setupLater: 'Настроить позже',
      finish: 'Завершить',
      finishWithoutSync: 'Продолжить без синхронизации',
      back: 'Назад',
      permissionRequired: 'Требуется разрешение',
      grantPermission: 'Предоставить доступ',
    },
  },
};

export const en = {
  onboarding: {
    skipTitle: 'Settings available in profile',
    skipMessage: 'You can set up week start day and calendar sync anytime in Profile → Settings',
    welcome: {
feature1: 'Everyone marks when they are busy',
feature2: 'Rehearsly finds the hours that suit all of you',
feature3: 'The rehearsal lands in everyone\'s calendar',
      title: 'Welcome!',
      subtitle: 'Rehearsly',
      description: 'Plan rehearsals, manage schedules, and sync calendars in one place',
      next: 'Get Started',
      skip: 'Skip',
    },
    weekStart: {
      title: 'Week Start Day',
      description: 'Which day does your week start on?',
      monday: 'Monday',
      sunday: 'Sunday',
      next: 'Next',
      back: 'Back',
      skip: 'Skip',
    },
    notifications: {
      title: 'Notifications',
      description: 'You will hear when someone puts you on a rehearsal, and when its time changes. Without them, you find out last.',
      allow: 'Turn on',
      later: 'Not now',
      back: 'Back',
      skip: 'Skip',
    },
    calendarSync: {
pickCalendar: 'Pick a calendar and your busy hours come across into the app',
      privacy: 'We read only the busy time slots. What the events are, the app never sees and never shows. Rehearsals go back out to your calendar.',
      connectedTitle: 'Calendar connected',
      connectedBody: 'Busy hours will come across on their own. Where the calendar does not cover everything, mark the rest in the app, on the Availability screen.',
      manualBody: 'Mark your time on the Availability screen. Until you do, everyone sees you as free.',
      title: 'Your availability',
      description: 'The company sees the hours you are taken, never what you are doing. Those hours can come from the calendar on your phone, which leaves you little to fill in by hand.',
      next: 'Next',
      google: 'Google Calendar',
      apple: 'Apple Calendar',
      setupLater: 'Set up later',
      finish: 'Finish',
      finishWithoutSync: 'Continue without sync',
      back: 'Back',
      permissionRequired: 'Permission required',
      grantPermission: 'Grant Access',
    },
  },
};

export const es = {
  onboarding: {
    skipTitle: 'Ajustes disponibles en el perfil',
    skipMessage: 'Puedes configurar el inicio de la semana y la sincronización del calendario en cualquier momento en Perfil → Ajustes',
    welcome: {
feature1: 'Cada quien marca cuándo está ocupado',
feature2: 'Rehearsly encuentra las horas que les sirven a todos',
feature3: 'El ensayo llega al calendario de cada uno',
      title: '¡Bienvenido!',
      subtitle: 'Rehearsly',
      description: 'Planifica ensayos, gestiona horarios y sincroniza calendarios en un solo lugar',
      next: 'Empezar',
      skip: 'Omitir',
    },
    weekStart: {
      title: 'Día de inicio de la semana',
      description: '¿Qué día empieza tu semana?',
      monday: 'Lunes',
      sunday: 'Domingo',
      next: 'Siguiente',
      back: 'Atrás',
      skip: 'Omitir',
    },
    notifications: {
      title: 'Notificaciones',
      description: 'Les avisamos cuando alguien los ponga en un ensayo y cuando cambie la hora. Sin ellas, se enteran los últimos.',
      allow: 'Activar',
      later: 'Ahora no',
      back: 'Atrás',
      skip: 'Omitir',
    },
    calendarSync: {
pickCalendar: 'Elijan un calendario y sus horas ocupadas pasan a la app',
      privacy: 'Leemos solo las franjas ocupadas. Qué son esos eventos, la app no lo ve ni lo muestra. Los ensayos vuelven a su calendario.',
      connectedTitle: 'Calendario conectado',
      connectedBody: 'Las horas ocupadas llegarán solas. Donde el calendario no alcance, marquen el resto en la pantalla Disponibilidad.',
      manualBody: 'Marquen su tiempo en la pantalla Disponibilidad. Hasta entonces, los demás los ven libres.',
      title: 'Su disponibilidad',
      description: 'El equipo ve las horas que están tomadas, nunca qué están haciendo. Esas horas pueden venir del calendario del teléfono, y así queda poco por marcar a mano.',
      next: 'Siguiente',
      google: 'Google Calendar',
      apple: 'Apple Calendar',
      setupLater: 'Configurar más tarde',
      finish: 'Finalizar',
      finishWithoutSync: 'Continuar sin sincronizar',
      back: 'Atrás',
      permissionRequired: 'Permiso requerido',
      grantPermission: 'Conceder acceso',
    },
  },
};

export const de = {
  onboarding: {
    skipTitle: 'Einstellungen im Profil verfügbar',
    skipMessage: 'Du kannst den Wochenbeginn und die Kalendersynchronisation jederzeit unter Profil → Einstellungen konfigurieren',
    welcome: {
feature1: 'Jeder trägt ein, wann er beschäftigt ist',
feature2: 'Rehearsly findet die Stunden, die allen passen',
feature3: 'Die Probe landet in jedem Kalender',
      title: 'Willkommen!',
      subtitle: 'Rehearsly',
      description: 'Plane Proben, verwalte Termine und synchronisiere Kalender an einem Ort',
      next: 'Loslegen',
      skip: 'Überspringen',
    },
    weekStart: {
      title: 'Wochenbeginn',
      description: 'An welchem Tag beginnt deine Woche?',
      monday: 'Montag',
      sunday: 'Sonntag',
      next: 'Weiter',
      back: 'Zurück',
      skip: 'Überspringen',
    },
    notifications: {
      title: 'Mitteilungen',
      description: 'Du hörst es, wenn dich jemand zu einer Probe einträgt und wenn sich die Zeit ändert. Ohne sie erfährst du es zuletzt.',
      allow: 'Einschalten',
      later: 'Jetzt nicht',
      back: 'Zurück',
      skip: 'Überspringen',
    },
    calendarSync: {
pickCalendar: 'Wähl einen Kalender — deine belegten Stunden kommen in die App',
      privacy: 'Wir lesen nur die belegten Zeitfenster. Worum es bei den Terminen geht, sieht die App nicht und zeigt sie niemandem. Proben gehen zurück in deinen Kalender.',
      connectedTitle: 'Kalender verbunden',
      connectedBody: 'Belegte Stunden kommen von selbst herüber. Wo der Kalender nicht alles abdeckt, trag den Rest unter „Zeiten“ ein.',
      manualBody: 'Trag deine Zeiten unter „Zeiten“ ein. Bis dahin giltst du als frei.',
      title: 'Deine Zeiten',
      description: 'Das Ensemble sieht die Stunden, in denen du besetzt bist, nie womit. Diese Stunden können aus dem Kalender deines Telefons kommen — dann bleibt kaum etwas von Hand einzutragen.',
      next: 'Weiter',
      google: 'Google Calendar',
      apple: 'Apple Calendar',
      setupLater: 'Später einrichten',
      finish: 'Fertigstellen',
      finishWithoutSync: 'Ohne Synchronisation fortfahren',
      back: 'Zurück',
      permissionRequired: 'Berechtigung erforderlich',
      grantPermission: 'Zugriff gewähren',
    },
  },
};
