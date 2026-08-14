export interface CalendarSyncTranslations {
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
  exportStatus: string;
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
  noCalendarsFound: string;
  noCalendarsMessage: string;
  noWritableCalendars: string;
  exportFailed: string;
  deleteFailed: string;
  // Phase 2: Import Settings
  importSettings: string;
  importStatus: string;
  importEnabled: string;
  importCalendar: string;
  importCalendars: string;
  selectCalendars: string;
  selectExportCalendar: string;
  selectImportCalendars: string;
  calendarsSelected: (count: number) => string;
  noCalendarsSelected: string;
  selectCalendarsFirst: string;
  // Phase 2: Import Actions
  importActions: string;
  importNow: string;
  clearImported: string;
  clearImportedConfirm: string;
  importSuccess: string;
  importSuccessMessage: (success: number, failed: number, skipped: number) => string;
  clearSuccess: string;
  clearImportedSuccess: string;
  importError: string;
  // Phase 2: Import Status
  importedCount: string;
  lastImport: string;
  neverImported: string;
  // Phase 2: Auto-import Frequency
  importInterval: string;
  manualOnly: string;
  autoImportEnabled: string;
  manual: string;
  always: string;
  fifteenMin: string;
  hourly: string;
  sixHours: string;
  daily: string;
  // Unified Sync
  autoSync: string;
  synchronize: string;
  resyncAll: string;
  resyncAllConfirm: string;
  resyncAllConfirmMessage: string;
  resyncSuccess: string;
  resyncSuccessMessage: (provider: string, count: number) => string;
  syncHint: string;
  // Time formatting
  justNow: string;
  minutesAgo: (minutes: number) => string;
  hoursAgo: (hours: number) => string;
  daysAgo: (days: number) => string;
  // Additional status
  imported: string;
  skipped: string;
  exportedRehearsals: string;
  lastExport: string;
  importedEvents: string;
  // Calendar picker
  chooseCalendar: string;
  exportTo: string;
}

export const ru = {
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
    exportStatus: 'Статус экспорта',
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
    noCalendarsFound: 'Календари не найдены',
    noCalendarsMessage: 'На устройстве не найдено доступных календарей',
    noWritableCalendars: 'Нет календарей для записи',
    exportFailed: 'Не удалось экспортировать',
    deleteFailed: 'Не удалось удалить из календаря',
    // Phase 2: Import Settings
    importSettings: 'Настройки импорта',
    importStatus: 'Статус импорта',
    importEnabled: 'Импортировать события календаря',
    importCalendar: 'Импорт из календаря',
    importCalendars: 'Импорт из календарей',
    selectCalendars: 'Выбрать календари',
    selectExportCalendar: 'Выберите календарь для экспорта',
    selectImportCalendars: 'Выберите календари для импорта',
    calendarsSelected: (count: number) => `Выбрано: ${count}`,
    noCalendarsSelected: 'Календари не выбраны',
    selectCalendarsFirst: 'Сначала выберите календари для импорта',
    // Phase 2: Import Actions
    importActions: 'Действия импорта',
    importNow: 'Импортировать сейчас',
    clearImported: 'Очистить импортированные',
    clearImportedConfirm: 'Удалить все импортированные события из вашей доступности?',
    importSuccess: 'Импорт выполнен',
    importSuccessMessage: (success: number, failed: number, skipped: number) =>
      `Импортировано: ${success}, Ошибок: ${failed}, Пропущено: ${skipped}`,
    clearSuccess: 'Успешно очищено',
    clearImportedSuccess: 'Импортированные события очищены',
    importError: 'Ошибка импорта',
    // Phase 2: Import Status
    importedCount: 'Импортировано событий',
    lastImport: 'Последний импорт',
    neverImported: 'Никогда не импортировалось',
    // Phase 2: Auto-import Frequency
    importInterval: 'Частота автоимпорта',
    manualOnly: 'Только вручную',
    autoImportEnabled: 'Синхронизируется при открытии приложения',
    manual: 'Вручную',
    always: 'Всегда',
    fifteenMin: '15 мин',
    hourly: 'Каждый час',
    sixHours: '6 часов',
    daily: 'Ежедневно',
    // Unified Sync
    autoSync: 'Автосинхронизация',
    synchronize: 'Синхронизировать',
    resyncAll: 'Пересинхронизировать все',
    resyncAllConfirm: 'Пересинхронизировать?',
    resyncAllConfirmMessage: 'Это удалит все старые события из календарей и создаст их заново в выбранном календаре. Продолжить?',
    resyncSuccess: 'Готово!',
    resyncSuccessMessage: (provider: string, count: number) => `Все репетиции перенесены в ${provider} Calendar!\n\nСинхронизировано: ${count}`,
    syncHint: 'Автоматическая синхронизация при открытии приложения. Используйте для синхронизации вручную.',
    // Time formatting
    justNow: 'Только что',
    minutesAgo: (minutes: number) => `${minutes} мин назад`,
    hoursAgo: (hours: number) => `${hours}ч назад`,
    daysAgo: (days: number) => `${days}д назад`,
    // Additional status
    imported: 'Импортировано',
    skipped: 'Пропущено',
    exportedRehearsals: 'Экспортировано репетиций',
    lastExport: 'Последний экспорт',
    importedEvents: 'Импортировано событий',
    // Calendar picker
    chooseCalendar: 'Выберите календарь для экспорта',
    exportTo: 'Экспорт в',
  },
};

export const en = {
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
    exportStatus: 'Export Status',
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
    noCalendarsFound: 'No calendars found',
    noCalendarsMessage: 'No calendars available on this device',
    noWritableCalendars: 'No writable calendars',
    exportFailed: 'Export failed',
    deleteFailed: 'Failed to delete from calendar',
    // Phase 2: Import Settings
    importSettings: 'Import Settings',
    importStatus: 'Import Status',
    importEnabled: 'Import calendar events',
    importCalendar: 'Import from Calendar',
    importCalendars: 'Import from calendars',
    selectCalendars: 'Select calendars',
    selectExportCalendar: 'Select Export Calendar',
    selectImportCalendars: 'Select Calendars to Import',
    calendarsSelected: (count: number) => `${count} selected`,
    noCalendarsSelected: 'No calendars selected',
    selectCalendarsFirst: 'Please select calendars to import from',
    // Phase 2: Import Actions
    importActions: 'Import Actions',
    importNow: 'Import Now',
    clearImported: 'Clear All Imported',
    clearImportedConfirm: 'Remove all imported events from your availability?',
    importSuccess: 'Import Successful',
    importSuccessMessage: (success: number, failed: number, skipped: number) =>
      `Imported: ${success}, Failed: ${failed}, Skipped: ${skipped}`,
    clearSuccess: 'Success',
    clearImportedSuccess: 'Imported events cleared',
    importError: 'Import Error',
    // Phase 2: Import Status
    importedCount: 'Imported events',
    lastImport: 'Last import',
    neverImported: 'Never',
    // Phase 2: Auto-import Frequency
    importInterval: 'Auto-import frequency',
    manualOnly: 'Import manually only',
    autoImportEnabled: 'Syncs when app opens',
    manual: 'Manual',
    always: 'Always',
    fifteenMin: '15 Min',
    hourly: 'Hourly',
    sixHours: '6 Hours',
    daily: 'Daily',
    // Unified Sync
    autoSync: 'Auto Sync',
    synchronize: 'Synchronize',
    resyncAll: 'Resync All',
    resyncAllConfirm: 'Resync all rehearsals?',
    resyncAllConfirmMessage: 'This will remove all old events from calendars and recreate them in the selected calendar. Continue?',
    resyncSuccess: 'Done!',
    resyncSuccessMessage: (provider: string, count: number) => `All rehearsals moved to ${provider} Calendar!\n\nSynced: ${count}`,
    syncHint: 'Syncs automatically when app opens. Use this for manual sync.',
    // Time formatting
    justNow: 'Just now',
    minutesAgo: (minutes: number) => `${minutes} min ago`,
    hoursAgo: (hours: number) => `${hours}h ago`,
    daysAgo: (days: number) => `${days}d ago`,
    // Additional status
    imported: 'Imported',
    skipped: 'Skipped',
    exportedRehearsals: 'Exported rehearsals',
    lastExport: 'Last export',
    importedEvents: 'Imported events',
    // Calendar picker
    chooseCalendar: 'Choose export calendar',
    exportTo: 'Export to',
  },
};

export const es = {
  calendarSync: {
    // Navigation
    title: 'Sincronización de calendario',
    // Permissions
    permissions: 'Permisos',
    permissionGranted: 'Acceso concedido',
    permissionDenied: 'Acceso denegado',
    permissionDeniedMessage: 'Se requiere acceso al calendario para usar esta función',
    permissionRequired: 'Acceso al calendario requerido',
    grantPermission: 'Conceder acceso',
    permissionInstructions: 'Concede acceso al calendario para sincronizar los ensayos',
    checkingPermissions: 'Comprobando permisos...',
    // Export Settings
    exportSettings: 'Ajustes de exportación',
    exportStatus: 'Estado de exportación',
    exportEnabled: 'Exportar ensayos',
    exportCalendar: 'Calendario de exportación',
    selectCalendar: 'Seleccionar calendario',
    targetCalendar: 'Calendario de destino',
    noCalendarSelected: 'Ningún calendario seleccionado',
    selectCalendarFirst: 'Primero selecciona un calendario',
    // Actions
    actions: 'Acciones',
    exportAll: 'Exportar todos los ensayos',
    exportAllProgress: (current: number, total: number) => `Exportando ${current} de ${total}...`,
    removeAll: 'Eliminar todo lo exportado',
    removeAllConfirm: '¿Eliminar todos los ensayos del calendario?',
    // Status
    status: 'Estado',
    lastSynced: 'Última sincronización',
    lastSync: 'Última sincronización',
    neverSynced: 'Nunca sincronizado',
    syncedCount: 'Ensayos sincronizados',
    never: 'Nunca',
    syncing: 'Sincronizando...',
    syncSuccess: 'Sincronizado correctamente',
    exportSuccess: 'Exportado correctamente',
    exportAllSuccess: 'Todos los ensayos exportados',
    removeSuccess: 'Eliminado correctamente',
    removeAllSuccess: 'Todos los ensayos eliminados del calendario',
    syncError: 'Error de sincronización',
    exportError: 'Error de exportación',
    exportErrorMessage: 'No se pudieron exportar los ensayos',
    rehearsalsSynced: (count: number) => `${count} ensayo${count !== 1 ? 's' : ''} sincronizado${count !== 1 ? 's' : ''}`,
    // Rehearsal indicators
    syncedToCalendar: 'Añadido al calendario',
    notSynced: 'No sincronizado',
    // Errors
    noCalendars: 'No se encontraron calendarios',
    noCalendarsFound: 'No se encontraron calendarios',
    noCalendarsMessage: 'No hay calendarios disponibles en este dispositivo',
    noWritableCalendars: 'No hay calendarios donde escribir',
    exportFailed: 'Error al exportar',
    deleteFailed: 'Error al eliminar del calendario',
    // Phase 2: Import Settings
    importSettings: 'Ajustes de importación',
    importStatus: 'Estado de importación',
    importEnabled: 'Importar eventos del calendario',
    importCalendar: 'Importar desde el calendario',
    importCalendars: 'Importar desde calendarios',
    selectCalendars: 'Seleccionar calendarios',
    selectExportCalendar: 'Selecciona el calendario de exportación',
    selectImportCalendars: 'Selecciona los calendarios para importar',
    calendarsSelected: (count: number) => `${count} seleccionado${count !== 1 ? 's' : ''}`,
    noCalendarsSelected: 'Ningún calendario seleccionado',
    selectCalendarsFirst: 'Primero selecciona los calendarios para importar',
    // Phase 2: Import Actions
    importActions: 'Acciones de importación',
    importNow: 'Importar ahora',
    clearImported: 'Borrar lo importado',
    clearImportedConfirm: '¿Eliminar todos los eventos importados de tu disponibilidad?',
    importSuccess: 'Importación correcta',
    importSuccessMessage: (success: number, failed: number, skipped: number) =>
      `Importados: ${success}, Fallidos: ${failed}, Omitidos: ${skipped}`,
    clearSuccess: 'Éxito',
    clearImportedSuccess: 'Eventos importados borrados',
    importError: 'Error de importación',
    // Phase 2: Import Status
    importedCount: 'Eventos importados',
    lastImport: 'Última importación',
    neverImported: 'Nunca',
    // Phase 2: Auto-import Frequency
    importInterval: 'Frecuencia de autoimportación',
    manualOnly: 'Solo importación manual',
    autoImportEnabled: 'Se sincroniza al abrir la app',
    manual: 'Manual',
    always: 'Siempre',
    fifteenMin: '15 min',
    hourly: 'Cada hora',
    sixHours: '6 horas',
    daily: 'Diariamente',
    // Unified Sync
    autoSync: 'Sincronización automática',
    synchronize: 'Sincronizar',
    resyncAll: 'Resincronizar todo',
    resyncAllConfirm: '¿Resincronizar todos los ensayos?',
    resyncAllConfirmMessage: 'Esto eliminará todos los eventos antiguos de los calendarios y los recreará en el calendario seleccionado. ¿Continuar?',
    resyncSuccess: '¡Listo!',
    resyncSuccessMessage: (provider: string, count: number) => `¡Todos los ensayos movidos al calendario de ${provider}!\n\nSincronizados: ${count}`,
    syncHint: 'Se sincroniza automáticamente al abrir la app. Úsalo para sincronizar manualmente.',
    // Time formatting
    justNow: 'Ahora mismo',
    minutesAgo: (minutes: number) => `hace ${minutes} min`,
    hoursAgo: (hours: number) => `hace ${hours} h`,
    daysAgo: (days: number) => `hace ${days} d`,
    // Additional status
    imported: 'Importados',
    skipped: 'Omitidos',
    exportedRehearsals: 'Ensayos exportados',
    lastExport: 'Última exportación',
    importedEvents: 'Eventos importados',
    // Calendar picker
    chooseCalendar: 'Elegir calendario de exportación',
    exportTo: 'Exportar a',
  },
};

export const de = {
  calendarSync: {
    // Navigation
    title: 'Kalendersynchronisation',
    // Permissions
    permissions: 'Berechtigungen',
    permissionGranted: 'Zugriff gewährt',
    permissionDenied: 'Zugriff verweigert',
    permissionDeniedMessage: 'Für diese Funktion ist Kalenderzugriff erforderlich',
    permissionRequired: 'Kalenderzugriff erforderlich',
    grantPermission: 'Zugriff gewähren',
    permissionInstructions: 'Gewähre Kalenderzugriff, um Proben zu synchronisieren',
    checkingPermissions: 'Berechtigungen werden geprüft...',
    // Export Settings
    exportSettings: 'Exporteinstellungen',
    exportStatus: 'Exportstatus',
    exportEnabled: 'Proben exportieren',
    exportCalendar: 'Kalender für Export',
    selectCalendar: 'Kalender auswählen',
    targetCalendar: 'Zielkalender',
    noCalendarSelected: 'Kein Kalender ausgewählt',
    selectCalendarFirst: 'Bitte zuerst einen Kalender auswählen',
    // Actions
    actions: 'Aktionen',
    exportAll: 'Alle Proben exportieren',
    exportAllProgress: (current: number, total: number) => `Export ${current} von ${total}...`,
    removeAll: 'Alle exportierten entfernen',
    removeAllConfirm: 'Alle Proben aus dem Kalender entfernen?',
    // Status
    status: 'Status',
    lastSynced: 'Letzte Synchronisation',
    lastSync: 'Letzte Synchronisation',
    neverSynced: 'Noch nie synchronisiert',
    syncedCount: 'Synchronisierte Proben',
    never: 'Nie',
    syncing: 'Wird synchronisiert...',
    syncSuccess: 'Erfolgreich synchronisiert',
    exportSuccess: 'Erfolgreich exportiert',
    exportAllSuccess: 'Alle Proben exportiert',
    removeSuccess: 'Erfolgreich entfernt',
    removeAllSuccess: 'Alle Proben aus dem Kalender entfernt',
    syncError: 'Synchronisationsfehler',
    exportError: 'Exportfehler',
    exportErrorMessage: 'Proben konnten nicht exportiert werden',
    rehearsalsSynced: (count: number) => `${count} Probe${count !== 1 ? 'n' : ''} synchronisiert`,
    // Rehearsal indicators
    syncedToCalendar: 'Zum Kalender hinzugefügt',
    notSynced: 'Nicht synchronisiert',
    // Errors
    noCalendars: 'Keine Kalender gefunden',
    noCalendarsFound: 'Keine Kalender gefunden',
    noCalendarsMessage: 'Auf diesem Gerät sind keine Kalender verfügbar',
    noWritableCalendars: 'Keine beschreibbaren Kalender',
    exportFailed: 'Export fehlgeschlagen',
    deleteFailed: 'Aus dem Kalender konnte nicht gelöscht werden',
    // Phase 2: Import Settings
    importSettings: 'Importeinstellungen',
    importStatus: 'Importstatus',
    importEnabled: 'Kalenderereignisse importieren',
    importCalendar: 'Aus Kalender importieren',
    importCalendars: 'Aus Kalendern importieren',
    selectCalendars: 'Kalender auswählen',
    selectExportCalendar: 'Exportkalender auswählen',
    selectImportCalendars: 'Importkalender auswählen',
    calendarsSelected: (count: number) => `${count} ausgewählt`,
    noCalendarsSelected: 'Keine Kalender ausgewählt',
    selectCalendarsFirst: 'Bitte zuerst Importkalender auswählen',
    // Phase 2: Import Actions
    importActions: 'Importaktionen',
    importNow: 'Jetzt importieren',
    clearImported: 'Importierte löschen',
    clearImportedConfirm: 'Alle importierten Ereignisse aus deiner Verfügbarkeit entfernen?',
    importSuccess: 'Import erfolgreich',
    importSuccessMessage: (success: number, failed: number, skipped: number) =>
      `Importiert: ${success}, Fehlgeschlagen: ${failed}, Übersprungen: ${skipped}`,
    clearSuccess: 'Erfolg',
    clearImportedSuccess: 'Importierte Ereignisse gelöscht',
    importError: 'Importfehler',
    // Phase 2: Import Status
    importedCount: 'Importierte Ereignisse',
    lastImport: 'Letzter Import',
    neverImported: 'Nie',
    // Phase 2: Auto-import Frequency
    importInterval: 'Häufigkeit des Auto-Imports',
    manualOnly: 'Nur manuell importieren',
    autoImportEnabled: 'Synchronisiert beim App-Start',
    manual: 'Manuell',
    always: 'Immer',
    fifteenMin: '15 Min',
    hourly: 'Stündlich',
    sixHours: '6 Stunden',
    daily: 'Täglich',
    // Unified Sync
    autoSync: 'Auto-Sync',
    synchronize: 'Synchronisieren',
    resyncAll: 'Alle neu synchronisieren',
    resyncAllConfirm: 'Alle neu synchronisieren?',
    resyncAllConfirmMessage: 'Dies entfernt alle alten Ereignisse aus den Kalendern und erstellt sie im ausgewählten Kalender neu. Fortfahren?',
    resyncSuccess: 'Fertig!',
    resyncSuccessMessage: (provider: string, count: number) => `Alle Proben wurden in den ${provider}-Kalender verschoben!\n\nSynchronisiert: ${count}`,
    syncHint: 'Synchronisiert automatisch beim App-Start. Nutze dies für manuelle Synchronisation.',
    // Time formatting
    justNow: 'Gerade eben',
    minutesAgo: (minutes: number) => `vor ${minutes} Min`,
    hoursAgo: (hours: number) => `vor ${hours} Std`,
    daysAgo: (days: number) => `vor ${days} T`,
    // Additional status
    imported: 'Importiert',
    skipped: 'Übersprungen',
    exportedRehearsals: 'Exportierte Proben',
    lastExport: 'Letzter Export',
    importedEvents: 'Importierte Ereignisse',
    // Calendar picker
    chooseCalendar: 'Exportkalender auswählen',
    exportTo: 'Exportieren nach',
  },
};
