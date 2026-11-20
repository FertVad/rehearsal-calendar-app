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
  markReadError: string;
  /** Under the last card, while there are older ones to load. */
  showOlder: string;
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
    emptyHint: 'Здесь появится всё, что происходит в ваших проектах.',
    markAllRead: 'Прочитать все',
    delete: 'Удалить',
    clearAll: 'Очистить',
    clearAllConfirm: 'Очистить уведомления?',
    clearAllConfirmBody: 'Список будет пуст. Отменить это нельзя.',
    deleteError: 'Не удалось удалить',
    markReadError: 'Не удалось отметить прочитанным',
    showOlder: 'Показать более ранние',
    loadError: 'Не удалось загрузить уведомления',
    justNow: 'только что',
    minutesAgo: (minutes: number) => `${minutes} мин назад`,
    hoursAgo: (hours: number) => `${hours} ч назад`,
    daysAgo: (days: number) => (days === 1 ? 'вчера' : `${days} дн. назад`),
  },
};

export const en: { notifications: NotificationsTranslations } = {
  notifications: {
    title: 'Notifications',
    empty: 'No Notifications Yet',
    emptyHint: 'Everything happening in your projects will show up here.',
    markAllRead: 'Mark All Read',
    delete: 'Delete',
    clearAll: 'Clear All',
    clearAllConfirm: 'Clear Notifications?',
    clearAllConfirmBody: 'All notifications will be deleted. This cannot be undone.',
    deleteError: 'Could not delete',
    markReadError: 'Could not mark as read',
    showOlder: 'Show Older',
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
    emptyHint: 'Aquí verás todo lo que pase en tus proyectos.',
    markAllRead: 'Marcar como leídas',
    delete: 'Eliminar',
    clearAll: 'Borrar todo',
    clearAllConfirm: '¿Borrar todas las notificaciones?',
    clearAllConfirmBody: 'La lista quedará vacía. Esto no se puede deshacer.',
    deleteError: 'No se pudo eliminar',
    markReadError: 'No se pudo marcar como leída',
    showOlder: 'Mostrar anteriores',
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
    emptyHint: 'Hier erscheint alles, was in deinen Projekten passiert.',
    markAllRead: 'Alle gelesen',
    delete: 'Löschen',
    clearAll: 'Alle löschen',
    clearAllConfirm: 'Alle Mitteilungen löschen?',
    clearAllConfirmBody: 'Die Liste wird geleert. Das lässt sich nicht rückgängig machen.',
    deleteError: 'Konnte nicht gelöscht werden',
    markReadError: 'Konnte nicht als gelesen markiert werden',
    showOlder: 'Ältere anzeigen',
    loadError: 'Mitteilungen konnten nicht geladen werden',
    justNow: 'gerade eben',
    minutesAgo: (minutes: number) => `vor ${minutes} Min.`,
    hoursAgo: (hours: number) => `vor ${hours} Std.`,
    daysAgo: (days: number) => (days === 1 ? 'gestern' : `vor ${days} Tagen`),
  },
};
