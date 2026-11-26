export interface CalendarSyncTranslations {
  // Navigation
  /**
   * The screen's bar, between "‹ Profile" and nothing, at 17 pt on a 393 pt
   * phone: «Синхронизация с календарём» was cut to «Синхронизация с ка…»
   * (T-239). Shorter, never smaller.
   */
  title: string;
  /**
   * What sync does, in one line at the top. Only the hours come in, never
   * what the events are: what onboarding promised (T-024).
   */
  explanation: string;
  // Permissions
  permissionDenied: string;
  permissionDeniedMessage: string;
  permissionRequired: string;
  grantPermission: string;
  checkingPermissions: string;
  // Export Settings
  selectCalendar: string;
  // Actions
  syncedAgo: (when: string) => string;
  inCalendar: (count: number) => string;
  removeAll: string;
  removeAllConfirm: string;
  /**
   * The button that removes every busy time imported from the phone's
   * calendars, from all the person's devices (T-270). The privacy policy names
   * it by this string, in each language (privacyPage.test.js).
   */
  clearImported: string;
  clearImportedConfirm: string;
  clearImportedMessage: string;
  clearImportedSuccess: string;
  /** Ends the question of either removal while Auto Sync is on: removing turns it off. */
  autoSyncTurnsOff: string;
  /** Auto Sync switched on before a calendar was picked. */
  chooseProviderFirst: string;
  // Status
  syncSuccess: string;
  removeAllSuccess: string;
  /** Some events could not be removed — say how many rather than claiming success. */
  removeAllPartial: (removed: number, failed: number) => string;
  /** A sync with failures says what did not get through, not "synced". */
  importIncomplete: (calendars: number) => string;
  exportIncomplete: (rehearsals: number) => string;
  syncError: string;
  // Errors
  noCalendarsFound: string;
  noWritableCalendars: string;
  // Unified Sync
  autoSync: string;
  synchronize: string;
  // Time formatting: as inside a sentence ("Synced just now");
  // formatLastSync gives the capital where they stand alone (T-239).
  justNow: string;
  minutesAgo: (minutes: number) => string;
  hoursAgo: (hours: number) => string;
  daysAgo: (days: number) => string;
  // Additional status
  imported: string;
  exportedRehearsals: string;
  // Calendar picker
  chooseCalendar: string;
  /**
   * The phone calendar's event for a rehearsal with no name of its own, in the
   * language chosen in the app (T-276): the project first, then the word the
   * screens use for a rehearsal (calendar.rehearsal; lower case after the colon
   * in Russian, the native speaker's choice). A name the organiser gave takes
   * the word's place as it is, in export.ts, never through this.
   */
  eventTitle: (project: string) => string;
  /** The event's notes. English events from before the URL mark are still known by their English ending (ownMark.ts). */
  eventNotes: (project: string) => string;
}

export const ru = {
  calendarSync: {
    // Navigation
    title: 'Синхронизация',
    explanation: 'Репетиции попадают в календарь телефона, а из него сюда — только часы, когда вы заняты, без названий событий.',
    // Permissions
    permissionDenied: 'Нет доступа',
    permissionDeniedMessage: 'Для этого нужен доступ к\u00a0календарю.',
    permissionRequired: 'Требуется доступ к календарю',
    grantPermission: 'Разрешить доступ',
    checkingPermissions: 'Проверка разрешений…',
    // Export Settings
    selectCalendar: 'Выбрать календарь',
    // Actions
    syncedAgo: (when: string) => `Синхронизировано ${when}`,
    inCalendar: (count: number) => `В календаре: ${count}`,
    removeAll: 'Удалить репетиции из календаря',
    removeAllConfirm: 'Удалить все репетиции из календаря телефона?',
    clearImported: 'Удалить импортированную занятость',
    clearImportedConfirm: 'Удалить всю импортированную занятость?',
    clearImportedMessage: 'Из Rehearsly удалится занятость, полученная из календарей всех ваших устройств. То, что вы отметили сами, останется.',
    clearImportedSuccess: 'Вся импортированная занятость удалена',
    autoSyncTurnsOff: 'Автосинхронизация на этом телефоне выключится, чтобы следующая синхронизация не вернула удалённое.',
    chooseProviderFirst: 'Сначала выберите «Google Календарь» или «Календарь iPhone».',
    // Status
    syncSuccess: 'Синхронизировано',
    removeAllSuccess: 'Все репетиции удалены из календаря телефона',
    removeAllPartial: (removed: number, failed: number) => `Удалено: ${removed}. Не удалось удалить: ${failed} — эти события остались в календаре.`,
    importIncomplete: (calendars: number) => `Не удалось прочитать календарей: ${calendars}.`,
    exportIncomplete: (rehearsals: number) => `Не удалось записать репетиций в календарь: ${rehearsals}.`,
    syncError: 'Ошибка синхронизации',
    // Errors
    noCalendarsFound: 'Календари не найдены',
    noWritableCalendars: 'Нет календарей для записи',
    // Unified Sync
    autoSync: 'Автосинхронизация',
    synchronize: 'Синхронизировать',
    // Time formatting
    justNow: 'только что',
    minutesAgo: (minutes: number) => `${minutes} мин назад`,
    hoursAgo: (hours: number) => `${hours} ч назад`,
    daysAgo: (days: number) => (days === 1 ? 'вчера' : `${days} дн. назад`),
    // Additional status
    imported: 'Импортировано',
    exportedRehearsals: 'Экспортировано репетиций',
    // Calendar picker
    chooseCalendar: 'Выберите календарь для экспорта',
    eventTitle: (project: string) => `${project}: репетиция`,
    eventNotes: (project: string) => `Проект: ${project}\n\nСоздано в Rehearsly`,
  },
};

export const en = {
  calendarSync: {
    // Navigation
    title: 'Calendar Sync',
    explanation: 'Rehearsals go into your phone’s calendar, and only the hours you are busy come back from it — never the details of your events.',
    // Permissions
    permissionDenied: 'Access Denied',
    permissionDeniedMessage: 'Calendar access is required to\u00a0use\u00a0this\u00a0feature.',
    permissionRequired: 'Calendar Access Required',
    grantPermission: 'Grant Access',
    checkingPermissions: 'Checking permissions…',
    // Export Settings
    selectCalendar: 'Select Calendar',
    // Actions
    syncedAgo: (when: string) => `Synced ${when}`,
    inCalendar: (count: number) => `In the calendar: ${count}`,
    removeAll: 'Remove Exported Rehearsals',
    removeAllConfirm: 'Remove All Rehearsals from the Calendar?',
    clearImported: 'Remove Imported Busy Times',
    clearImportedConfirm: 'Remove All Imported Busy Times?',
    clearImportedMessage: 'Busy times imported from calendars on all your devices will be removed from Rehearsly. Anything you marked yourself will stay.',
    clearImportedSuccess: 'All imported busy times removed',
    autoSyncTurnsOff: 'Auto Sync will also be turned off — otherwise the next sync would bring it all back.',
    chooseProviderFirst: 'To turn on Auto Sync, select Google Calendar or Apple Calendar below.',
    // Status
    syncSuccess: 'Synced',
    removeAllSuccess: 'All rehearsals removed from the calendar',
    removeAllPartial: (removed: number, failed: number) => `Removed: ${removed}. Could not remove: ${failed} — ${failed === 1 ? 'that event is' : 'those events are'} still in the calendar.`,
    importIncomplete: (calendars: number) => `Calendars that could not be read: ${calendars}.`,
    exportIncomplete: (rehearsals: number) => `Rehearsals that could not be written to the calendar: ${rehearsals}.`,
    syncError: 'Sync Error',
    // Errors
    noCalendarsFound: 'No calendars found',
    noWritableCalendars: 'No editable calendars',
    // Unified Sync
    autoSync: 'Auto Sync',
    synchronize: 'Sync Now',
    // Time formatting
    justNow: 'just now',
    minutesAgo: (minutes: number) => `${minutes} min ago`,
    hoursAgo: (hours: number) => `${hours}h ago`,
    daysAgo: (days: number) => (days === 1 ? 'yesterday' : `${days}d ago`),
    // Additional status
    imported: 'Imported',
    exportedRehearsals: 'Exported rehearsals',
    // Calendar picker
    chooseCalendar: 'Choose Export Calendar',
    eventTitle: (project: string) => `${project}: Rehearsal`,
    eventNotes: (project: string) => `Project: ${project}\n\nCreated via Rehearsly`,
  },
};

export const es = {
  calendarSync: {
    // Navigation
    title: 'Sincronización',
    explanation: 'Los ensayos pasan al calendario del teléfono; de él solo llegan las horas que tienes ocupadas, nunca el nombre de los eventos.',
    // Permissions
    permissionDenied: 'Acceso denegado',
    permissionDeniedMessage: 'Se requiere acceso\u00a0al\u00a0calendario para\u00a0usar\u00a0esta\u00a0función.',
    permissionRequired: 'Se necesita acceso al calendario',
    grantPermission: 'Conceder acceso',
    checkingPermissions: 'Comprobando permisos…',
    // Export Settings
    selectCalendar: 'Seleccionar calendario',
    // Actions
    syncedAgo: (when: string) => `Sincronizado ${when}`,
    inCalendar: (count: number) => `En el calendario: ${count}`,
    removeAll: 'Eliminar todo lo exportado',
    removeAllConfirm: '¿Eliminar todos los ensayos del calendario?',
    clearImported: 'Eliminar horas importadas',
    clearImportedConfirm: '¿Eliminar todas las horas importadas?',
    clearImportedMessage: 'Se eliminarán de Rehearsly las horas ocupadas que llegaron de los calendarios de todos tus dispositivos. Las que marcaste tú se mantienen.',
    clearImportedSuccess: 'Se eliminaron todas las horas importadas',
    autoSyncTurnsOff: 'La sincronización automática se desactivará en este dispositivo; si no, la próxima sincronización volvería a añadirlo todo.',
    chooseProviderFirst: 'Elige primero Google Calendar o Apple Calendar.',
    // Status
    syncSuccess: 'Sincronización completada',
    removeAllSuccess: 'Se eliminaron todos los ensayos del calendario',
    removeAllPartial: (removed: number, failed: number) => (failed === 1
      ? `Eliminados: ${removed}. Un evento no se pudo eliminar y sigue en el calendario.`
      : `Eliminados: ${removed}. No se pudieron eliminar ${failed} eventos, que siguen en el calendario.`),
    importIncomplete: (calendars: number) => `Calendarios que no se pudieron leer: ${calendars}.`,
    exportIncomplete: (rehearsals: number) => `Ensayos que no se pudieron escribir en el calendario: ${rehearsals}.`,
    syncError: 'Error de sincronización',
    // Errors
    noCalendarsFound: 'No se encontraron calendarios',
    noWritableCalendars: 'No hay calendarios donde escribir',
    // Unified Sync
    autoSync: 'Sincronización automática',
    synchronize: 'Sincronizar',
    // Time formatting
    justNow: 'ahora mismo',
    minutesAgo: (minutes: number) => `hace ${minutes} min`,
    hoursAgo: (hours: number) => `hace ${hours} h`,
    daysAgo: (days: number) => (days === 1 ? 'ayer' : `hace ${days} d`),
    // Additional status
    imported: 'Importados',
    exportedRehearsals: 'Ensayos exportados',
    // Calendar picker
    chooseCalendar: 'Elegir calendario de exportación',
    eventTitle: (project: string) => `${project}: Ensayo`,
    eventNotes: (project: string) => `Proyecto: ${project}\n\nCreado con Rehearsly`,
  },
};

export const de = {
  calendarSync: {
    // Navigation
    title: 'Kalender-Sync',
    explanation: 'Proben landen in deiner Kalender-App. Von dort übernimmt Rehearsly nur, wann du beschäftigt bist – nie, wie deine Termine heißen.',
    // Permissions
    permissionDenied: 'Zugriff verweigert',
    permissionDeniedMessage: 'Für diese Funktion ist Kalenderzugriff\u00a0erforderlich.',
    permissionRequired: 'Kalenderzugriff erforderlich',
    grantPermission: 'Zugriff gewähren',
    checkingPermissions: 'Berechtigungen werden geprüft\u00a0…',
    // Export Settings
    selectCalendar: 'Kalender auswählen',
    // Actions
    syncedAgo: (when: string) => `Synchronisiert: ${when}`,
    inCalendar: (count: number) => `Im Kalender: ${count}`,
    removeAll: 'Alle exportierten Proben entfernen',
    removeAllConfirm: 'Alle Proben aus dem Kalender entfernen?',
    clearImported: 'Alle importierten Zeiten löschen',
    clearImportedConfirm: 'Alle importierten Zeiten löschen?',
    clearImportedMessage: 'Das betrifft alle belegten Zeiten aus deinen Kalendern – auch die von deinen anderen Geräten. Was du selbst eingetragen hast, bleibt.',
    clearImportedSuccess: 'Alle importierten Zeiten gelöscht',
    autoSyncTurnsOff: 'Auto-Sync wird auf diesem Gerät ausgeschaltet, sonst wäre nach der nächsten Synchronisation alles wieder da.',
    chooseProviderFirst: 'Tippe zuerst auf „Google Kalender“ oder „Apple Kalender“.',
    // Status
    syncSuccess: 'Synchronisiert',
    removeAllSuccess: 'Alle Proben aus dem Kalender entfernt',
    removeAllPartial: (removed: number, failed: number) => `Entfernt: ${removed}. Nicht entfernt: ${failed} – diese Termine stehen noch im Kalender.`,
    importIncomplete: (calendars: number) => `Kalender, die nicht gelesen werden konnten: ${calendars}.`,
    exportIncomplete: (rehearsals: number) => `Proben, die nicht in den Kalender geschrieben werden konnten: ${rehearsals}.`,
    syncError: 'Synchronisationsfehler',
    // Errors
    noCalendarsFound: 'Keine Kalender gefunden',
    noWritableCalendars: 'Keine beschreibbaren Kalender',
    // Unified Sync
    autoSync: 'Auto-Sync',
    synchronize: 'Synchronisieren',
    // Time formatting
    justNow: 'gerade eben',
    minutesAgo: (minutes: number) => `vor ${minutes} Min.`,
    hoursAgo: (hours: number) => `vor ${hours} Std.`,
    daysAgo: (days: number) => (days === 1 ? 'gestern' : `vor ${days} Tagen`),
    // Additional status
    imported: 'Importiert',
    exportedRehearsals: 'Exportierte Proben',
    // Calendar picker
    chooseCalendar: 'Exportkalender auswählen',
    eventTitle: (project: string) => `${project}: Probe`,
    eventNotes: (project: string) => `Projekt: ${project}\n\nErstellt mit Rehearsly`,
  },
};
