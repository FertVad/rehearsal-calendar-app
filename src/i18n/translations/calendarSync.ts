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
  noCalendarsMessage: string;
  noWritableCalendars: string;
  exportFailed: string;
  deleteFailed: string;
  // Phase 2: Import Settings
  importSettings: string;
  importStatus: string;
  importEnabled: string;
  importCalendars: string;
  selectCalendars: string;
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
    noCalendarsMessage: 'На устройстве не найдено доступных календарей',
    noWritableCalendars: 'Нет календарей для записи',
    exportFailed: 'Не удалось экспортировать',
    deleteFailed: 'Не удалось удалить из календаря',
    // Phase 2: Import Settings
    importSettings: 'Настройки импорта',
    importStatus: 'Статус импорта',
    importEnabled: 'Импортировать события календаря',
    importCalendars: 'Импорт из календарей',
    selectCalendars: 'Выбрать календари',
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
    noCalendarsMessage: 'No calendars available on this device',
    noWritableCalendars: 'No writable calendars',
    exportFailed: 'Export failed',
    deleteFailed: 'Failed to delete from calendar',
    // Phase 2: Import Settings
    importSettings: 'Import Settings',
    importStatus: 'Import Status',
    importEnabled: 'Import calendar events',
    importCalendars: 'Import from calendars',
    selectCalendars: 'Select calendars',
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
  },
};
