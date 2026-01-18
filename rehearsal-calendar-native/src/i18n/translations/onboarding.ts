export interface OnboardingTranslations {
  skipTitle: string;
  skipMessage: string;
  welcome: {
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
  calendarSync: {
    title: string;
    description: string;
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
      title: 'Добро пожаловать!',
      subtitle: 'Rehearsal Calendar',
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
    calendarSync: {
      title: 'Синхронизация календаря',
      description: 'Синхронизируйте репетиции с вашим календарем',
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
      title: 'Welcome!',
      subtitle: 'Rehearsal Calendar',
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
    calendarSync: {
      title: 'Calendar Sync',
      description: 'Sync your rehearsals with your calendar',
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
