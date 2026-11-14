export interface CalendarTranslations {
  needProject: string;
  allProjects: string;
  loading: string;
  upcomingEvents: string;
  noUpcoming: string;
  tomorrow: string;
  todayButton: string;
  /** The arrows beside the open month's name, for VoiceOver: they are only icons (T-254). */
  previousMonth: string;
  nextMonth: string;
  smartPlannerSubtitle: string;
  rehearsal: string;
}

export interface RehearsalsTranslations {
  addRehearsal: string;
  editRehearsal: string;
  rehearsalTitle: string;
  rehearsalTitlePlaceholder: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  project: string;
  selectProject: string;
  selectStartTime: string;
  selectEndTime: string;
  locationPlaceholder: string;
  createError: string;
  deleteConfirm: string;
  /** The confirmation's title: the rehearsal's name, if it has one, its day and start. */
  deleteTitle: (title: string | null, when: string) => string;
  /** Under it: how many will be told it is cancelled. */
  deleteNotifies: (count: number) => string;
  /** In place of the confirmation, when who would be told could not be read. */
  deleteNotifiedUnknown: string;
  deleteError: string;
  /** The card's swipe and the details' corner: open the rehearsal in the form. */
  edit: string;
  participants: string;
  /** Under one's own name in a rehearsal's participants, the row put first. */
  you: string;
  createRehearsal: string;
  updateRehearsal: string;
  loadMembersError: string;
  loadAvailabilityError: string;
  projectNotSelected: string;
  endTimeError: string;
  /** Beside an end time that is on the day after the start. */
  endsNextDay: string;
  scheduleConflict: string;
  scheduleConflictMessage: string;
  /** Above scheduleConflictMessage: who of those picked is busy then, `count` of them. */
  busyAtThisTime: (names: string, count: number) => string;
  createAnyway: string;
  success: string;
  rehearsalCreated: string;
  rehearsalUpdated: string;
  updateError: string;
  loadRehearsalError: string;
  participantsLeft: string;
  availabilityChecking: string;
  seenError: string;
  /** The eye on a rehearsal, for VoiceOver: it is only an icon. */
  markSeen: string;
  /** In place of the eye: an admin sees this rehearsal but is not on it, so
   *  there is nothing to mark (T-232). */
  notOnRoster: string;
  /** The count under the eye, for VoiceOver, where there is no eye to say it
   *  as its value — a rehearsal the reader is not on (T-232). */
  seenCount: (count: string) => string;
  noProjects: string;
  noAdminProjects: string;
  createNewProject: string;
  loadingMembers: string;
  noMembers: string;
  /** The participants row and sheet: how many of the project are picked. */
  participantsCount: (selected: number, total: number) => string;
  /** The planner's row with everyone picked: "All participants · 4" (T-241). */
  participantsEveryone: (total: number) => string;
  /** The sheet's three-state box over everyone. */
  allParticipants: string;
  searchParticipants: string;
  /** Under the participants row: someone picked is busy at the rehearsal's time. */
  busyAt: (name: string, time: string) => string;
  andMore: (count: number) => string;
  /** Beside the name of someone busy the whole day. */
  wholeDay: string;
  admin: string;
  /** Shown when a rehearsal cannot be opened — deleted, or the reader was taken off it. */
  notFound: string;
  recommendedTime: string;
  noAvailableTime: string;
  /** In place of the recommendations: nobody picked is busy all working day (T-238). */
  everyoneFreeAllDay: string;
  hoursShort: string;
}

export const ru = {
  calendar: {
    needProject: 'Репетиции появятся, когда вы окажетесь в проекте',
    allProjects: 'Все проекты',
    loading: 'Загрузка репетиций...',
    upcomingEvents: 'Ближайшие события',
    noUpcoming: 'Репетиций пока не назначено',
    tomorrow: 'Завтра',
    todayButton: 'Сегодня',
    previousMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    smartPlannerSubtitle: 'Найти оптимальное время для репетиции',
    rehearsal: 'Репетиция',
  },
  rehearsals: {
    addRehearsal: 'Добавить репетицию',
    editRehearsal: 'Редактировать репетицию',
    rehearsalTitle: 'Название',
    rehearsalTitlePlaceholder: 'Например: Прогон второго акта',
    date: 'Дата',
    startTime: 'Начало',
    endTime: 'Конец',
    location: 'Место проведения',
    project: 'Проект',
    selectProject: 'Выберите проект',
    selectStartTime: 'Выберите время начала',
    selectEndTime: 'Выберите время окончания',
    locationPlaceholder: 'Адрес или название места',
    createError: 'Не удалось создать репетицию',
    deleteConfirm: 'Удалить',
    deleteTitle: (title: string | null, when: string) =>
      title ? `Удалить «${title}», ${when}?` : `Удалить репетицию, ${when}?`,
    deleteNotifies: (count: number) => `Участники (${count}) получат уведомление`,
    deleteNotifiedUnknown: 'Не удалось узнать, кто получит уведомление об отмене. Проверьте соединение и повторите.',
    deleteError: 'Не удалось удалить репетицию',
    edit: 'Изменить',
    participants: 'Участники',
    you: 'Вы',
    createRehearsal: 'Создать репетицию',
    updateRehearsal: 'Сохранить изменения',
    loadMembersError: 'Не удалось загрузить участников проекта',
    loadAvailabilityError: 'Не удалось загрузить занятость участников',
    projectNotSelected: 'Выберите проект для создания репетиции',
    endTimeError: 'Время окончания не может совпадать со временем начала',
    endsNextDay: 'следующего дня',
    scheduleConflict: '⚠️ Конфликт расписания',
    scheduleConflictMessage: 'Всё равно создать репетицию?',
    busyAtThisTime: (names: string, count: number) =>
      // "не может" has no gender; "занят(а)" guessed one.
      count === 1 ? `В это время не может: ${names}` : `В это время не могут: ${names}`,
    createAnyway: 'Создать всё равно',
    success: 'Готово',
    rehearsalCreated: 'Репетиция создана',
    rehearsalUpdated: 'Репетиция сохранена',
    updateError: 'Не удалось обновить репетицию',
    loadRehearsalError: 'Не удалось загрузить репетицию. Проверьте соединение и попробуйте ещё раз.',
    participantsLeft: 'Кто-то из выбранных участников больше не в проекте. Откройте форму заново и сохраните ещё раз.',
    availabilityChecking: 'Занятость участников на этот день ещё проверяется.',
    seenError: 'Не удалось отметить просмотр',
    markSeen: 'Отметить просмотренным',
    notOnRoster: 'Вы не в составе',
    seenCount: (count: string) => `Просмотрели: ${count}`,
    noProjects: 'Нет проектов',
    noAdminProjects: 'Нет проектов, где вы администратор',
    createNewProject: 'Создать новый проект',
    loadingMembers: 'Загрузка участников...',
    noMembers: 'Нет участников в проекте',
    participantsCount: (selected: number, total: number) => `${selected} из ${total}`,
    participantsEveryone: (total: number) => `Все участники · ${total}`,
    allParticipants: 'Все участники',
    searchParticipants: 'Поиск',
    // The time is taken, not the person: "Иванова занят" was a man's word.
    busyAt: (name: string, time: string) => `${name}: занято ${time}`,
    andMore: (count: number) => `и ещё ${count}`,
    wholeDay: 'весь день',
    admin: 'админ',
    notFound: 'Репетиция не найдена. Возможно, её удалили или вас сняли с неё.',
    recommendedTime: 'Рекомендованное время',
    noAvailableTime: 'Нет времени, когда свободны все выбранные участники',
    everyoneFreeAllDay: 'Все свободны весь день',
    hoursShort: 'ч',
  },
};

export const en = {
  calendar: {
    needProject: 'Rehearsals show up once you are in a project',
    allProjects: 'All Projects',
    loading: 'Loading rehearsals...',
    upcomingEvents: 'Upcoming Events',
    noUpcoming: 'Nothing scheduled yet',
    tomorrow: 'Tomorrow',
    todayButton: 'Today',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    smartPlannerSubtitle: 'Find the best time for a rehearsal',
    rehearsal: 'Rehearsal',
  },
  rehearsals: {
    addRehearsal: 'Add Rehearsal',
    editRehearsal: 'Edit Rehearsal',
    rehearsalTitle: 'Title',
    rehearsalTitlePlaceholder: 'e.g. Act II run-through',
    date: 'Date',
    startTime: 'Start Time',
    endTime: 'End Time',
    location: 'Location',
    project: 'Project',
    selectProject: 'Select Project',
    selectStartTime: 'Select Start Time',
    selectEndTime: 'Select End Time',
    locationPlaceholder: 'Address or venue name',
    createError: 'Could not create the rehearsal',
    deleteConfirm: 'Delete',
    deleteTitle: (title: string | null, when: string) =>
      title ? `Delete “${title}”, ${when}?` : `Delete the rehearsal, ${when}?`,
    deleteNotifies: (count: number) => `Participants (${count}) will be notified`,
    deleteNotifiedUnknown: 'Could not find out who will be told it is cancelled. Check your connection and try again.',
    deleteError: 'Could not delete the rehearsal',
    edit: 'Edit',
    participants: 'Participants',
    you: 'You',
    createRehearsal: 'Create Rehearsal',
    updateRehearsal: 'Save Changes',
    loadMembersError: 'Failed to load project members',
    loadAvailabilityError: 'Failed to load member availability',
    projectNotSelected: 'Select a project to create a rehearsal',
    endTimeError: 'End time cannot be the same as start time',
    endsNextDay: 'next day',
    scheduleConflict: '⚠️ Schedule Conflict',
    scheduleConflictMessage: 'Are you sure you want to create this rehearsal?',
    busyAtThisTime: (names: string, count: number) =>
      count === 1 ? `${names} is busy at this time` : `${names} are busy at this time`,
    createAnyway: 'Create Anyway',
    success: 'Done',
    rehearsalCreated: 'Rehearsal created',
    rehearsalUpdated: 'Rehearsal updated successfully',
    updateError: 'Failed to update rehearsal',
    loadRehearsalError: 'Could not load the rehearsal. Check your connection and try again.',
    participantsLeft: 'Someone you selected is no longer in the project. Open the form again and save once more.',
    availabilityChecking: "The participants' availability for this day is still being checked.",
    seenError: 'Could not mark it as seen',
    markSeen: 'Mark as seen',
    notOnRoster: 'You are not in the cast',
    seenCount: (count: string) => `Seen: ${count}`,
    noProjects: 'No projects',
    noAdminProjects: 'No projects where you are an administrator',
    createNewProject: 'Create New Project',
    loadingMembers: 'Loading members...',
    noMembers: 'No members in project',
    participantsCount: (selected: number, total: number) => `${selected} of ${total}`,
    participantsEveryone: (total: number) => `All participants · ${total}`,
    allParticipants: 'All participants',
    searchParticipants: 'Search',
    busyAt: (name: string, time: string) => `${name} busy ${time}`,
    andMore: (count: number) => `and ${count} more`,
    wholeDay: 'all day',
    admin: 'admin',
    notFound: 'This rehearsal is not available. It may have been deleted, or you were taken off it.',
    recommendedTime: 'Recommended Time',
    noAvailableTime: 'No time when all selected participants are free',
    everyoneFreeAllDay: 'Everyone is free all day',
    hoursShort: 'h',
  },
};

export const es = {
  calendar: {
    needProject: 'Los ensayos aparecerán cuando estés en un proyecto',
    allProjects: 'Todos los proyectos',
    loading: 'Cargando ensayos...',
    upcomingEvents: 'Próximos eventos',
    noUpcoming: 'Nada programado todavía',
    tomorrow: 'Mañana',
    todayButton: 'Hoy',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    smartPlannerSubtitle: 'Encuentra el mejor horario para ensayar',
    rehearsal: 'Ensayo',
  },
  rehearsals: {
    addRehearsal: 'Añadir ensayo',
    editRehearsal: 'Editar ensayo',
    rehearsalTitle: 'Título',
    rehearsalTitlePlaceholder: 'Ej.: Pasada del segundo acto',
    date: 'Fecha',
    startTime: 'Inicio',
    endTime: 'Fin',
    location: 'Lugar',
    project: 'Proyecto',
    selectProject: 'Seleccionar proyecto',
    selectStartTime: 'Seleccionar hora de inicio',
    selectEndTime: 'Seleccionar hora de fin',
    locationPlaceholder: 'Dirección o nombre del lugar',
    createError: 'Error al crear el ensayo',
    deleteConfirm: 'Eliminar',
    deleteTitle: (title: string | null, when: string) =>
      title ? `¿Eliminar «${title}», ${when}?` : `¿Eliminar el ensayo, ${when}?`,
    deleteNotifies: (count: number) => `Los participantes (${count}) recibirán un aviso`,
    deleteNotifiedUnknown: 'No se pudo saber quién recibirá el aviso de la cancelación. Revisa la conexión e inténtalo de nuevo.',
    deleteError: 'No se pudo eliminar el ensayo',
    edit: 'Editar',
    participants: 'Participantes',
    you: 'Tú',
    createRehearsal: 'Crear ensayo',
    updateRehearsal: 'Guardar cambios',
    loadMembersError: 'No se pudieron cargar los miembros del proyecto',
    loadAvailabilityError: 'No se pudo cargar la disponibilidad de los miembros',
    projectNotSelected: 'Selecciona un proyecto para crear un ensayo',
    endTimeError: 'La hora de fin no puede ser igual a la de inicio',
    endsNextDay: 'día siguiente',
    scheduleConflict: '⚠️ Conflicto de horario',
    scheduleConflictMessage: '¿Seguro que quieres crear este ensayo?',
    busyAtThisTime: (names: string, count: number) =>
      // "no puede" has no gender; "ocupado/a" guessed one.
      count === 1 ? `${names} no puede a esa hora` : `${names} no pueden a esa hora`,
    createAnyway: 'Crear de todos modos',
    success: 'Listo',
    rehearsalCreated: 'Ensayo creado',
    rehearsalUpdated: 'Ensayo actualizado',
    updateError: 'No se pudo actualizar el ensayo',
    loadRehearsalError: 'No se pudo cargar el ensayo. Comprueba la conexión e inténtalo de nuevo.',
    participantsLeft: 'Alguien que seleccionaste ya no está en el proyecto. Abre el formulario de nuevo y guarda otra vez.',
    availabilityChecking: 'Aún se está comprobando la disponibilidad de los participantes para este día.',
    seenError: 'No se pudo marcar como visto',
    markSeen: 'Marcar como visto',
    notOnRoster: 'No estás en el reparto',
    seenCount: (count: string) => `Vistos: ${count}`,
    noProjects: 'No hay proyectos',
    noAdminProjects: 'No hay proyectos que administres',
    createNewProject: 'Crear nuevo proyecto',
    loadingMembers: 'Cargando miembros...',
    noMembers: 'No hay miembros en el proyecto',
    participantsCount: (selected: number, total: number) => `${selected} de ${total}`,
    participantsEveryone: (total: number) => `Todos los participantes · ${total}`,
    allParticipants: 'Todos los participantes',
    searchParticipants: 'Buscar',
    busyAt: (name: string, time: string) => `${name}: no disponible ${time}`,
    andMore: (count: number) => `y ${count} más`,
    wholeDay: 'todo el día',
    admin: 'admin',
    notFound: 'Este ensayo no está disponible. Puede que se haya eliminado o que te hayan quitado de él.',
    recommendedTime: 'Hora recomendada',
    noAvailableTime: 'No hay ninguna hora en que estén libres todos los participantes seleccionados',
    everyoneFreeAllDay: 'Todos están libres todo el día',
    hoursShort: 'h',
  },
};

export const de = {
  calendar: {
    needProject: 'Proben erscheinen, sobald du in einem Projekt bist',
    allProjects: 'Alle Projekte',
    loading: 'Proben werden geladen...',
    upcomingEvents: 'Anstehende Termine',
    noUpcoming: 'Noch nichts angesetzt',
    tomorrow: 'Morgen',
    todayButton: 'Heute',
    previousMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    smartPlannerSubtitle: 'Finde die beste Probezeit',
    rehearsal: 'Probe',
  },
  rehearsals: {
    addRehearsal: 'Probe hinzufügen',
    editRehearsal: 'Probe bearbeiten',
    rehearsalTitle: 'Titel',
    rehearsalTitlePlaceholder: 'z. B. Durchlauf zweiter Akt',
    date: 'Datum',
    startTime: 'Beginn',
    endTime: 'Ende',
    location: 'Ort',
    project: 'Projekt',
    selectProject: 'Projekt auswählen',
    selectStartTime: 'Startzeit auswählen',
    selectEndTime: 'Endzeit auswählen',
    locationPlaceholder: 'Adresse oder Name des Ortes',
    createError: 'Fehler beim Erstellen der Probe',
    deleteConfirm: 'Löschen',
    deleteTitle: (title: string | null, when: string) =>
      title ? `„${title}“ löschen, ${when}?` : `Probe löschen, ${when}?`,
    deleteNotifies: (count: number) => `Teilnehmer (${count}) werden benachrichtigt`,
    deleteNotifiedUnknown: 'Es ließ sich nicht ermitteln, wer über die Absage benachrichtigt wird. Prüfe die Verbindung und versuche es erneut.',
    deleteError: 'Die Probe konnte nicht gelöscht werden',
    edit: 'Bearbeiten',
    participants: 'Teilnehmer',
    you: 'Du',
    createRehearsal: 'Probe erstellen',
    updateRehearsal: 'Änderungen speichern',
    loadMembersError: 'Projektmitglieder konnten nicht geladen werden',
    loadAvailabilityError: 'Verfügbarkeit der Mitglieder konnte nicht geladen werden',
    projectNotSelected: 'Wähle ein Projekt aus, um eine Probe zu erstellen',
    endTimeError: 'Die Endzeit darf nicht gleich der Startzeit sein',
    endsNextDay: 'am nächsten Tag',
    scheduleConflict: '⚠️ Terminkonflikt',
    scheduleConflictMessage: 'Möchtest du diese Probe wirklich erstellen?',
    busyAtThisTime: (names: string, count: number) =>
      count === 1 ? `${names} ist zu dieser Zeit beschäftigt` : `${names} sind zu dieser Zeit beschäftigt`,
    createAnyway: 'Trotzdem erstellen',
    success: 'Erledigt',
    rehearsalCreated: 'Probe erstellt',
    rehearsalUpdated: 'Probe aktualisiert',
    updateError: 'Probe konnte nicht aktualisiert werden',
    loadRehearsalError: 'Die Probe konnte nicht geladen werden. Prüfe die Verbindung und versuche es erneut.',
    participantsLeft: 'Jemand, den du ausgewählt hast, ist nicht mehr im Projekt. Öffne das Formular erneut und speichere noch einmal.',
    availabilityChecking: 'Die Verfügbarkeit der Teilnehmer für diesen Tag wird noch geprüft.',
    seenError: 'Die Probe konnte nicht als gesehen markiert werden',
    markSeen: 'Als gesehen markieren',
    notOnRoster: 'Du bist nicht in der Besetzung',
    seenCount: (count: string) => `Gesehen: ${count}`,
    noProjects: 'Keine Projekte',
    noAdminProjects: 'Keine Projekte, die du verwaltest',
    createNewProject: 'Neues Projekt erstellen',
    loadingMembers: 'Mitglieder werden geladen...',
    noMembers: 'Keine Mitglieder im Projekt',
    participantsCount: (selected: number, total: number) => `${selected} von ${total}`,
    participantsEveryone: (total: number) => `Alle Teilnehmer · ${total}`,
    allParticipants: 'Alle Teilnehmer',
    searchParticipants: 'Suchen',
    busyAt: (name: string, time: string) => `${name}: beschäftigt ${time}`,
    // One more as iOS counts people ("und 1 weiterer"), masculine after
    // "Teilnehmer"; "und 1 weitere Person" was cut on the phone (T-258).
    andMore: (count: number) => (count === 1 ? 'und 1 weiterer' : `und ${count} weitere`),
    wholeDay: 'ganztägig',
    admin: 'Admin',
    // "abgemeldet" is signed out; taken off the cast is "aus der Besetzung genommen".
    notFound: 'Diese Probe ist nicht verfügbar. Vielleicht wurde sie gelöscht, oder du wurdest aus der Besetzung genommen.',
    recommendedTime: 'Empfohlene Zeit',
    noAvailableTime: 'Keine verfügbare Zeit für alle ausgewählten Teilnehmer',
    everyoneFreeAllDay: 'Alle haben den ganzen Tag Zeit',
    hoursShort: 'Std.',
  },
};
