export interface CalendarTranslations {
  title: string;
  rehearsalsFor: string;
  noRehearsals: string;
  selectProject: string;
  myRehearsals: string;
  allProjects: string;
  filterByProject: string;
  loading: string;
  location: string;
  time: string;
  upcomingEvents: string;
  todayRehearsals: string;
  noUpcoming: string;
  tomorrow: string;
  todayButton: string;
  smartPlannerSubtitle: string;
  rehearsalsCount: (count: number) => string;
  rehearsal: string;
  upcomingCount: (count: number) => string;
}

export interface RehearsalsTranslations {
  addRehearsal: string;
  editRehearsal: string;
  myRehearsals: string;
  upcoming: string;
  noUpcoming: string;
  willAppear: string;
  rehearsalTitle: string;
  rehearsalTitlePlaceholder: string;
  scene: string;
  date: string;
  time: string;
  startTime: string;
  endTime: string;
  duration: string;
  notes: string;
  actors: string;
  location: string;
  project: string;
  selectProject: string;
  selectDate: string;
  selectStartTime: string;
  selectEndTime: string;
  locationPlaceholder: string;
  creating: string;
  created: string;
  createError: string;
  deleteConfirm: string;
  deleteTitle: string;
  deleteMessage: string;
  deleteSuccess: string;
  participants: string;
  createRehearsal: string;
  updateRehearsal: string;
  loadMembersError: string;
  loadAvailabilityError: string;
  projectNotSelected: string;
  endTimeError: string;
  scheduleConflict: string;
  scheduleConflictMessage: string;
  createAnyway: string;
  success: string;
  rehearsalCreated: string;
  rehearsalUpdated: string;
  updateError: string;
  seenError: string;
  noProjects: string;
  noAdminProjects: string;
  createNewProject: string;
  loadingMembers: string;
  noMembers: string;
  selectAll: string;
  deselectAll: string;
  expand: string;
  collapse: string;
  selectedCount: (selected: number, total: number) => string;
  admin: string;
  availableStatus: string;
  busyAllDay: string;
  busyTime: string;
  rehearsalDetails: string;
  like: string;
  unlike: string;
  recommendedTime: string;
  noAvailableTime: string;
  hoursShort: string;
}

export const ru = {
  calendar: {
    title: 'Календарь репетиций',
    rehearsalsFor: 'Репетиции на',
    noRehearsals: 'В этот день репетиций нет',
    selectProject: 'Выберите проект в разделе "Проекты"',
    myRehearsals: 'Мои репетиции',
    allProjects: 'Все проекты',
    filterByProject: 'Фильтр по проекту',
    loading: 'Загрузка репетиций...',
    location: 'Место',
    time: 'Время',
    upcomingEvents: 'Ближайшие события',
    todayRehearsals: 'Репетиции на сегодня',
    noUpcoming: 'Нет предстоящих репетиций',
    tomorrow: 'Завтра',
    todayButton: 'Сегодня',
    smartPlannerSubtitle: 'Найти оптимальное время для репетиции',
    rehearsalsCount: (count: number) => `Репетиции (${count})`,
    rehearsal: 'Репетиция',
    upcomingCount: (count: number) => `Предстоящие (${count})`,
  },
  rehearsals: {
    addRehearsal: 'Добавить репетицию',
    editRehearsal: 'Редактировать репетицию',
    myRehearsals: 'Мои репетиции',
    upcoming: 'Предстоящие',
    noUpcoming: 'Нет предстоящих репетиций',
    willAppear: 'Тут будут ваши репетиции',
    rehearsalTitle: 'Название',
    rehearsalTitlePlaceholder: 'Например: Прогон второго акта',
    scene: 'Сцена',
    date: 'Дата',
    time: 'Время',
    startTime: 'Начало',
    endTime: 'Конец',
    duration: 'Длительность',
    notes: 'Заметки',
    actors: 'Актёры',
    location: 'Место проведения',
    project: 'Проект',
    selectProject: 'Выберите проект',
    selectDate: 'Выберите дату',
    selectStartTime: 'Выберите время начала',
    selectEndTime: 'Выберите время окончания',
    locationPlaceholder: 'Адрес или название места',
    creating: 'Создание...',
    created: 'Репетиция создана',
    createError: 'Ошибка создания репетиции',
    deleteConfirm: 'Удалить',
    deleteTitle: 'Удалить репетицию?',
    deleteMessage: 'Это действие нельзя отменить',
    deleteSuccess: 'Репетиция удалена',
    participants: 'Участники',
    createRehearsal: 'Создать репетицию',
    updateRehearsal: 'Сохранить изменения',
    loadMembersError: 'Не удалось загрузить участников проекта',
    loadAvailabilityError: 'Не удалось загрузить доступность участников',
    projectNotSelected: 'Выберите проект для создания репетиции',
    endTimeError: 'Время окончания должно быть позже времени начала',
    scheduleConflict: '⚠️ Конфликт расписания',
    scheduleConflictMessage: 'Вы уверены, что хотите создать репетицию?',
    createAnyway: 'Создать всё равно',
    success: 'Успешно',
    rehearsalCreated: 'Репетиция создана',
    rehearsalUpdated: 'Репетиция успешно обновлена',
    updateError: 'Не удалось обновить репетицию',
    seenError: 'Не удалось отметить просмотр',
    noProjects: 'Нет проектов',
    noAdminProjects: 'Нет проектов, где вы являетесь администратором',
    createNewProject: 'Создать новый проект',
    loadingMembers: 'Загрузка участников...',
    noMembers: 'Нет участников в проекте',
    selectAll: 'Выбрать всех',
    deselectAll: 'Снять выделение',
    expand: 'Развернуть',
    collapse: 'Свернуть',
    selectedCount: (selected: number, total: number) => `Выбрано: ${selected} из ${total}`,
    admin: 'Админ',
    availableStatus: 'Свободен',
    busyAllDay: 'Занят весь день',
    busyTime: 'Занят',
    rehearsalDetails: 'Детали репетиции',
    like: 'Иду',
    unlike: 'Отменить',
    recommendedTime: 'Рекомендованное время',
    noAvailableTime: 'Нет свободного времени для всех выбранных участников',
    hoursShort: 'ч',
  },
};

export const en = {
  calendar: {
    title: 'Rehearsal Calendar',
    rehearsalsFor: 'Rehearsals for',
    noRehearsals: 'Nothing on this day',
    selectProject: 'Select a project in "Projects" section',
    myRehearsals: 'My Rehearsals',
    allProjects: 'All Projects',
    filterByProject: 'Filter by Project',
    loading: 'Loading rehearsals...',
    location: 'Location',
    time: 'Time',
    upcomingEvents: 'Upcoming Events',
    todayRehearsals: "Today's Rehearsals",
    noUpcoming: 'No upcoming rehearsals',
    tomorrow: 'Tomorrow',
    todayButton: 'Today',
    smartPlannerSubtitle: 'Find the best time for rehearsal',
    rehearsalsCount: (count: number) => `Rehearsals (${count})`,
    rehearsal: 'Rehearsal',
    upcomingCount: (count: number) => `Upcoming (${count})`,
  },
  rehearsals: {
    addRehearsal: 'Add Rehearsal',
    editRehearsal: 'Edit Rehearsal',
    myRehearsals: 'My Rehearsals',
    upcoming: 'Upcoming',
    noUpcoming: 'No upcoming rehearsals',
    willAppear: 'Your rehearsals will be here',
    rehearsalTitle: 'Title',
    rehearsalTitlePlaceholder: 'e.g. Act II run-through',
    scene: 'Scene',
    date: 'Date',
    time: 'Time',
    startTime: 'Start Time',
    endTime: 'End Time',
    duration: 'Duration',
    notes: 'Notes',
    actors: 'Actors',
    location: 'Location',
    project: 'Project',
    selectProject: 'Select Project',
    selectDate: 'Select Date',
    selectStartTime: 'Select Start Time',
    selectEndTime: 'Select End Time',
    locationPlaceholder: 'Address or venue name',
    creating: 'Creating...',
    created: 'Rehearsal created',
    createError: 'Error creating rehearsal',
    deleteConfirm: 'Delete',
    deleteTitle: 'Delete Rehearsal?',
    deleteMessage: 'This action cannot be undone',
    deleteSuccess: 'Rehearsal deleted',
    participants: 'Participants',
    createRehearsal: 'Create Rehearsal',
    updateRehearsal: 'Save Changes',
    loadMembersError: 'Failed to load project members',
    loadAvailabilityError: 'Failed to load member availability',
    projectNotSelected: 'Select a project to create a rehearsal',
    endTimeError: 'End time must be after start time',
    scheduleConflict: '⚠️ Schedule Conflict',
    scheduleConflictMessage: 'Are you sure you want to create this rehearsal?',
    createAnyway: 'Create Anyway',
    success: 'Success',
    rehearsalCreated: 'Rehearsal created',
    rehearsalUpdated: 'Rehearsal updated successfully',
    updateError: 'Failed to update rehearsal',
    seenError: 'Could not mark it as seen',
    noProjects: 'No projects',
    noAdminProjects: 'No projects where you are an administrator',
    createNewProject: 'Create New Project',
    loadingMembers: 'Loading members...',
    noMembers: 'No members in project',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    expand: 'Expand',
    collapse: 'Collapse',
    selectedCount: (selected: number, total: number) => `Selected: ${selected} of ${total}`,
    admin: 'Admin',
    availableStatus: 'Available',
    busyAllDay: 'Busy all day',
    busyTime: 'Busy',
    rehearsalDetails: 'Rehearsal Details',
    like: 'Going',
    unlike: 'Cancel',
    recommendedTime: 'Recommended Time',
    noAvailableTime: 'No available time for all selected participants',
    hoursShort: 'h',
  },
};

export const es = {
  calendar: {
    title: 'Calendario de ensayos',
    rehearsalsFor: 'Ensayos para',
    noRehearsals: 'Nada en este día',
    selectProject: 'Selecciona un proyecto en la sección "Proyectos"',
    myRehearsals: 'Mis ensayos',
    allProjects: 'Todos los proyectos',
    filterByProject: 'Filtrar por proyecto',
    loading: 'Cargando ensayos...',
    location: 'Lugar',
    time: 'Hora',
    upcomingEvents: 'Próximos eventos',
    todayRehearsals: 'Ensayos de hoy',
    noUpcoming: 'No hay ensayos próximos',
    tomorrow: 'Mañana',
    todayButton: 'Hoy',
    smartPlannerSubtitle: 'Encuentra el mejor horario para ensayar',
    rehearsalsCount: (count: number) => `Ensayos (${count})`,
    rehearsal: 'Ensayo',
    upcomingCount: (count: number) => `Próximos (${count})`,
  },
  rehearsals: {
    addRehearsal: 'Añadir ensayo',
    editRehearsal: 'Editar ensayo',
    myRehearsals: 'Mis ensayos',
    upcoming: 'Próximos',
    noUpcoming: 'No hay ensayos próximos',
    willAppear: 'Aquí estarán sus ensayos',
    rehearsalTitle: 'Título',
    rehearsalTitlePlaceholder: 'Ej.: Pasada del segundo acto',
    scene: 'Escena',
    date: 'Fecha',
    time: 'Hora',
    startTime: 'Inicio',
    endTime: 'Fin',
    duration: 'Duración',
    notes: 'Notas',
    actors: 'Actores',
    location: 'Lugar',
    project: 'Proyecto',
    selectProject: 'Seleccionar proyecto',
    selectDate: 'Seleccionar fecha',
    selectStartTime: 'Seleccionar hora de inicio',
    selectEndTime: 'Seleccionar hora de fin',
    locationPlaceholder: 'Dirección o nombre del lugar',
    creating: 'Creando...',
    created: 'Ensayo creado',
    createError: 'Error al crear el ensayo',
    deleteConfirm: 'Eliminar',
    deleteTitle: '¿Eliminar ensayo?',
    deleteMessage: 'Esta acción no se puede deshacer',
    deleteSuccess: 'Ensayo eliminado',
    participants: 'Participantes',
    createRehearsal: 'Crear ensayo',
    updateRehearsal: 'Guardar cambios',
    loadMembersError: 'No se pudieron cargar los miembros del proyecto',
    loadAvailabilityError: 'No se pudo cargar la disponibilidad de los miembros',
    projectNotSelected: 'Selecciona un proyecto para crear un ensayo',
    endTimeError: 'La hora de fin debe ser posterior a la de inicio',
    scheduleConflict: '⚠️ Conflicto de horario',
    scheduleConflictMessage: '¿Seguro que quieres crear este ensayo?',
    createAnyway: 'Crear de todos modos',
    success: 'Éxito',
    rehearsalCreated: 'Ensayo creado',
    rehearsalUpdated: 'Ensayo actualizado correctamente',
    updateError: 'No se pudo actualizar el ensayo',
    seenError: 'No se pudo marcar como visto',
    noProjects: 'No hay proyectos',
    noAdminProjects: 'No hay proyectos en los que seas administrador',
    createNewProject: 'Crear nuevo proyecto',
    loadingMembers: 'Cargando miembros...',
    noMembers: 'No hay miembros en el proyecto',
    selectAll: 'Seleccionar todos',
    deselectAll: 'Deseleccionar todos',
    expand: 'Expandir',
    collapse: 'Contraer',
    selectedCount: (selected: number, total: number) => `Seleccionados: ${selected} de ${total}`,
    admin: 'Admin',
    availableStatus: 'Disponible',
    busyAllDay: 'Ocupado todo el día',
    busyTime: 'Ocupado',
    rehearsalDetails: 'Detalles del ensayo',
    like: 'Voy',
    unlike: 'Cancelar',
    recommendedTime: 'Hora recomendada',
    noAvailableTime: 'No hay tiempo disponible para todos los participantes seleccionados',
    hoursShort: 'h',
  },
};

export const de = {
  calendar: {
    title: 'Probenkalender',
    rehearsalsFor: 'Proben für',
    noRehearsals: 'An diesem Tag nichts',
    selectProject: 'Wähle ein Projekt im Bereich „Projekte" aus',
    myRehearsals: 'Meine Proben',
    allProjects: 'Alle Projekte',
    filterByProject: 'Nach Projekt filtern',
    loading: 'Proben werden geladen...',
    location: 'Ort',
    time: 'Zeit',
    upcomingEvents: 'Nächste Ereignisse',
    todayRehearsals: 'Heutige Proben',
    noUpcoming: 'Keine bevorstehenden Proben',
    tomorrow: 'Morgen',
    todayButton: 'Heute',
    smartPlannerSubtitle: 'Finde die beste Probezeit',
    rehearsalsCount: (count: number) => `Proben (${count})`,
    rehearsal: 'Probe',
    upcomingCount: (count: number) => `Bevorstehend (${count})`,
  },
  rehearsals: {
    addRehearsal: 'Probe hinzufügen',
    editRehearsal: 'Probe bearbeiten',
    myRehearsals: 'Meine Proben',
    upcoming: 'Bevorstehend',
    noUpcoming: 'Keine bevorstehenden Proben',
    willAppear: 'Hier stehen deine Proben',
    rehearsalTitle: 'Titel',
    rehearsalTitlePlaceholder: 'z. B. Durchlauf zweiter Akt',
    scene: 'Szene',
    date: 'Datum',
    time: 'Zeit',
    startTime: 'Beginn',
    endTime: 'Ende',
    duration: 'Dauer',
    notes: 'Notizen',
    actors: 'Darsteller',
    location: 'Ort',
    project: 'Projekt',
    selectProject: 'Projekt auswählen',
    selectDate: 'Datum auswählen',
    selectStartTime: 'Startzeit auswählen',
    selectEndTime: 'Endzeit auswählen',
    locationPlaceholder: 'Adresse oder Name des Ortes',
    creating: 'Wird erstellt...',
    created: 'Probe erstellt',
    createError: 'Fehler beim Erstellen der Probe',
    deleteConfirm: 'Löschen',
    deleteTitle: 'Probe löschen?',
    deleteMessage: 'Diese Aktion kann nicht rückgängig gemacht werden',
    deleteSuccess: 'Probe gelöscht',
    participants: 'Teilnehmer',
    createRehearsal: 'Probe erstellen',
    updateRehearsal: 'Änderungen speichern',
    loadMembersError: 'Projektmitglieder konnten nicht geladen werden',
    loadAvailabilityError: 'Verfügbarkeit der Mitglieder konnte nicht geladen werden',
    projectNotSelected: 'Wähle ein Projekt aus, um eine Probe zu erstellen',
    endTimeError: 'Die Endzeit muss nach der Startzeit liegen',
    scheduleConflict: '⚠️ Terminkonflikt',
    scheduleConflictMessage: 'Möchtest du diese Probe wirklich erstellen?',
    createAnyway: 'Trotzdem erstellen',
    success: 'Erfolg',
    rehearsalCreated: 'Probe erstellt',
    rehearsalUpdated: 'Probe erfolgreich aktualisiert',
    updateError: 'Probe konnte nicht aktualisiert werden',
    seenError: 'Konnte nicht als gesehen markiert werden',
    noProjects: 'Keine Projekte',
    noAdminProjects: 'Keine Projekte, in denen du Administrator bist',
    createNewProject: 'Neues Projekt erstellen',
    loadingMembers: 'Mitglieder werden geladen...',
    noMembers: 'Keine Mitglieder im Projekt',
    selectAll: 'Alle auswählen',
    deselectAll: 'Auswahl aufheben',
    expand: 'Erweitern',
    collapse: 'Einklappen',
    selectedCount: (selected: number, total: number) => `Ausgewählt: ${selected} von ${total}`,
    admin: 'Admin',
    availableStatus: 'Verfügbar',
    busyAllDay: 'Ganztägig beschäftigt',
    busyTime: 'Beschäftigt',
    rehearsalDetails: 'Probendetails',
    like: 'Ich komme',
    unlike: 'Abmelden',
    recommendedTime: 'Empfohlene Zeit',
    noAvailableTime: 'Keine verfügbare Zeit für alle ausgewählten Teilnehmer',
    hoursShort: 'Std.',
  },
};
