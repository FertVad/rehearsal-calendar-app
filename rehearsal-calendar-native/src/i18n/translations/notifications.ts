export interface NotificationsTranslations {
  title: string;
  empty: string;
  emptyHint: string;
  markAllRead: string;
  delete: string;
  clearAll: string;
  clearAllConfirm: string;
  clearAllConfirmBody: string;
  loadError: string;
  deleteError: string;
  /** Relative age of a notification. */
  justNow: string;
  minutesAgo: (minutes: number) => string;
  hoursAgo: (hours: number) => string;
  daysAgo: (days: number) => string;
}

export const ru: { notifications: NotificationsTranslations } = {
  notifications: {
    title: 'Уведомления',
    empty: 'Пока тихо',
    emptyHint: 'Здесь появятся напоминания о репетициях и всё, что происходит в ваших проектах.',
    markAllRead: 'Отметить все',
    delete: 'Удалить',
    clearAll: 'Очистить',
    clearAllConfirm: 'Очистить уведомления?',
    clearAllConfirmBody: 'Список будет пуст. Отменить это нельзя.',
    deleteError: 'Не удалось удалить',
    loadError: 'Не удалось загрузить уведомления',
    justNow: 'только что',
    minutesAgo: (minutes: number) => `${minutes} мин назад`,
    hoursAgo: (hours: number) => `${hours} ч назад`,
    daysAgo: (days: number) => (days === 1 ? 'вчера' : `${days} дн назад`),
  },
};

export const en: { notifications: NotificationsTranslations } = {
  notifications: {
    title: 'Notifications',
    empty: 'Nothing yet',
    emptyHint: 'Rehearsal reminders and anything happening in your projects will show up here.',
    markAllRead: 'Mark all read',
    delete: 'Delete',
    clearAll: 'Clear all',
    clearAllConfirm: 'Clear notifications?',
    clearAllConfirmBody: 'The list will be empty. This cannot be undone.',
    deleteError: 'Could not delete',
    loadError: 'Could not load notifications',
    justNow: 'just now',
    minutesAgo: (minutes: number) => `${minutes} min ago`,
    hoursAgo: (hours: number) => `${hours}h ago`,
    daysAgo: (days: number) => (days === 1 ? 'yesterday' : `${days}d ago`),
  },
};

export const es: { notifications: NotificationsTranslations } = {
  notifications: {
    title: 'Notificaciones',
    empty: 'Todavía nada',
    emptyHint: 'Aquí verán los recordatorios de ensayos y todo lo que pase en sus proyectos.',
    markAllRead: 'Marcar todas',
    delete: 'Eliminar',
    clearAll: 'Vaciar',
    clearAllConfirm: '¿Vaciar las notificaciones?',
    clearAllConfirmBody: 'La lista quedará vacía. Esto no se puede deshacer.',
    deleteError: 'No se pudo eliminar',
    loadError: 'No se pudieron cargar las notificaciones',
    justNow: 'ahora mismo',
    minutesAgo: (minutes: number) => `hace ${minutes} min`,
    hoursAgo: (hours: number) => `hace ${hours} h`,
    daysAgo: (days: number) => (days === 1 ? 'ayer' : `hace ${days} d`),
  },
};

export const de: { notifications: NotificationsTranslations } = {
  notifications: {
    title: 'Mitteilungen',
    empty: 'Noch nichts',
    emptyHint: 'Hier erscheinen Probenerinnerungen und alles, was in deinen Projekten passiert.',
    markAllRead: 'Alle als gelesen',
    delete: 'Löschen',
    clearAll: 'Leeren',
    clearAllConfirm: 'Mitteilungen leeren?',
    clearAllConfirmBody: 'Die Liste wird leer sein. Das lässt sich nicht rückgängig machen.',
    deleteError: 'Konnte nicht gelöscht werden',
    loadError: 'Mitteilungen konnten nicht geladen werden',
    justNow: 'gerade eben',
    minutesAgo: (minutes: number) => `vor ${minutes} Min`,
    hoursAgo: (hours: number) => `vor ${hours} Std`,
    daysAgo: (days: number) => (days === 1 ? 'gestern' : `vor ${days} T`),
  },
};
