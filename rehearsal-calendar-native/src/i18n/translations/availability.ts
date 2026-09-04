export interface AvailabilityTranslations {
  title: string;
  available: string;
  unavailable: string;
  timeSlots: string;
  addSlot: string;
  from: string;
  to: string;
  free: string;
  nothingMarked: string;
  busy: string;
  partial: string;
  legend: string;
  saving: string;
  saved: string;
  saveError: string;
  selectDates: string;
  busyTime: string;
  /** Heading over the rows the user did not enter: phone-calendar events and rehearsals. */
  fromCalendar: string;
  fromDeviceCalendar: string;
  fromRehearsal: string;
  importedNote: string;
  startTime: string;
  endTime: string;
  deleteData: string;
  deleteDataConfirm: string;
  deleteDataMessage: string;
  pastDateWarning: string;
  cannotSave: string;
  invalidSlot: string;
  slotsOverlap: string;
  slotEndBeforeStart: string;
  fixSlots: string;
  understood: string;
  selectedDates: (count: number) => string;
  freeAllDay: string;
  busyAllDay: string;
  /** Label for a read-only calendar row that takes the whole day. */
  allDay: string;
}

export interface SmartPlannerTranslations {
  title: string;
  period: string;
  members: string;
  recommendations: string;
  analyzing: string;
  noSlots: string;
  noSlotsMessage: string;
  errorLoading: string;
  week: string;
  twoWeeks: string;
  month: string;
  custom: string;
  customPeriod: string;
  slotsCount: (count: number) => string;
  allDay: string;
  /** Named members who have never recorded availability and so count as free. */
  unknownAvailability: (names: string) => string;
  addButton: string;
  selectAll: string;
  clearAll: string;
  selectMembers: string;
  applyFilter: string;
  perfect: string;
  good: string;
  possible: string;
  difficult: string;
  available: string;
  busy: string;
  selectedMembers: string;
  allMembers: string;
  noneSelected: string;
  allAvailable: string;
  allBusy: string;
  busyPrefix: string;
  expand: string;
  collapse: string;
  of: string;
  selected: string;
  noMembers: string;
}

export const ru = {
  availability: {
    title: 'Занятость',
    available: 'Доступен',
    unavailable: 'Недоступен',
    timeSlots: 'Временные слоты',
    addSlot: 'Добавить слот',
    from: 'С',
    to: 'До',
nothingMarked: 'Отметьте, когда вы заняты. Пока вы этого не сделали, вас считают свободным.',
    free: 'Свободен',
    busy: 'Занят',
    partial: 'Частично',
    legend: 'Легенда',
    saving: 'Сохранение...',
    saved: 'Занятость сохранена',
    saveError: 'Не удалось сохранить занятость',
    selectDates: 'Выберите даты',
    busyTime: 'Время когда занят',
    fromCalendar: 'Уже есть в этот день',
    fromDeviceCalendar: 'из календаря',
    fromRehearsal: 'репетиция',
    importedNote: 'Эти часы видят остальные, когда подбирают время. Чтобы освободить их, удалите событие в календаре телефона.',
    startTime: 'Время начала',
    endTime: 'Время окончания',
    deleteData: 'Удалить данные этой даты',
    deleteDataConfirm: 'Удалить данные?',
    deleteDataMessage: 'Вы уверены, что хотите удалить данные занятости для этой прошедшей даты?',
    pastDateWarning: 'Это прошедшая дата. Вы можете удалить данные, но не редактировать.',
    cannotSave: 'Невозможно сохранить',
    invalidSlot: 'Пожалуйста, исправьте время слотов и попробуйте снова.',
    slotsOverlap: 'Слоты не должны пересекаться',
    slotEndBeforeStart: 'Время окончания должно быть позже начала',
    fixSlots: 'Пожалуйста, исправьте время слотов и попробуйте снова.',
    understood: 'Понятно',
    selectedDates: (count: number) => `Выбрано дат: ${count}`,
    freeAllDay: 'Вы доступны весь день для репетиций',
    busyAllDay: 'Вы недоступны в этот день',
    allDay: 'Весь день',
  },
  smartPlanner: {
    title: 'Smart Planner',
    period: 'Период',
    members: 'Участники',
    recommendations: 'Рекомендации',
    analyzing: 'Анализируем доступность...',
    noSlots: 'Пока показывать нечего',
    noSlotsMessage: 'Здесь появляются часы, когда свободна вся команда. Для этого участники должны отметить свою занятость — или попробуйте другой период.',
    errorLoading: 'Ошибка загрузки',
    week: 'Неделя',
    twoWeeks: 'Две недели',
    month: 'Месяц',
    custom: 'Выбрать даты',
    customPeriod: 'Свой период',
    slotsCount: (count: number) => {
      // 1 слот, 2 слота, 5 слотов — и 11..14 идут по последней форме
      const mod10 = count % 10;
      const mod100 = count % 100;
      if (mod10 === 1 && mod100 !== 11) return `${count} слот`;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} слота`;
      return `${count} слотов`;
    },
    allDay: 'Весь день',
    unknownAvailability: (names: string) => `Нет данных о занятости: ${names}. В расчёте они считаются свободными.`,
    addButton: '+ Добавить',
    selectAll: 'Все',
    clearAll: 'Очистить',
    selectMembers: 'Участники',
    applyFilter: 'Применить',
    perfect: 'Идеально',
    good: 'Хорошо',
    possible: 'Возможно',
    difficult: 'Сложно',
    available: 'Свободны',
    busy: 'Заняты',
    selectedMembers: 'выбрано',
    allMembers: 'Все участники',
    noneSelected: 'Никто не выбран',
    allAvailable: 'Все свободны',
    allBusy: 'Все заняты',
    busyPrefix: 'Заняты',
    expand: 'Развернуть',
    collapse: 'Свернуть',
    of: 'из',
    selected: 'выбрано',
    noMembers: 'Нет участников',
  },
};

export const en = {
  availability: {
    title: 'Availability',
    available: 'Available',
    unavailable: 'Unavailable',
    timeSlots: 'Time slots',
    addSlot: 'Add slot',
    from: 'From',
    to: 'To',
nothingMarked: 'Mark when you are busy. Until you do, everyone sees you as free.',
    free: 'Free',
    busy: 'Busy',
    partial: 'Partial',
    legend: 'Legend',
    saving: 'Saving...',
    saved: 'Availability saved',
    saveError: 'Failed to save availability',
    selectDates: 'Select dates',
    busyTime: 'Busy time',
    fromCalendar: 'Already on this day',
    fromDeviceCalendar: 'from calendar',
    fromRehearsal: 'rehearsal',
    importedNote: 'Everyone else sees these hours when looking for a time. To free them up, delete the event in your phone calendar.',
    startTime: 'Start time',
    endTime: 'End time',
    deleteData: 'Delete this date data',
    deleteDataConfirm: 'Delete data?',
    deleteDataMessage: 'Are you sure you want to delete availability data for this past date?',
    pastDateWarning: 'This is a past date. You can delete data, but not edit.',
    cannotSave: 'Cannot save',
    invalidSlot: 'Please fix the time slots and try again.',
    slotsOverlap: 'Slots must not overlap',
    slotEndBeforeStart: 'End time must be after the start time',
    fixSlots: 'Please fix the time slots and try again.',
    understood: 'Understood',
    selectedDates: (count: number) => `Selected dates: ${count}`,
    freeAllDay: 'You are available all day for rehearsals',
    busyAllDay: 'You are unavailable on this day',
    allDay: 'All day',
  },
  smartPlanner: {
    title: 'Smart Planner',
    period: 'Period',
    members: 'Members',
    recommendations: 'Recommendations',
    analyzing: 'Analyzing availability...',
    noSlots: 'Nothing to show yet',
    noSlotsMessage: 'This is where the hours everyone can make show up. For that, people have to mark their time — or try another period.',
    errorLoading: 'Error loading',
    week: 'Week',
    twoWeeks: 'Two Weeks',
    month: 'Month',
    custom: 'Select Dates',
    customPeriod: 'Custom Period',
    slotsCount: (count: number) => `${count} ${count === 1 ? 'slot' : 'slots'}`,
    allDay: 'All day',
    unknownAvailability: (names: string) => `No availability recorded: ${names}. They are counted as free.`,
    addButton: '+ Add',
    selectAll: 'All',
    clearAll: 'Clear',
    selectMembers: 'Members',
    applyFilter: 'Apply',
    perfect: 'Perfect',
    good: 'Good',
    possible: 'Possible',
    difficult: 'Difficult',
    available: 'Available',
    busy: 'Busy',
    selectedMembers: 'selected',
    allMembers: 'All Members',
    noneSelected: 'None selected',
    allAvailable: 'All available',
    allBusy: 'All busy',
    busyPrefix: 'Busy',
    expand: 'Expand',
    collapse: 'Collapse',
    of: 'of',
    selected: 'selected',
    noMembers: 'No members',
  },
};

export const es = {
  availability: {
    title: 'Disponibilidad',
    available: 'Disponible',
    unavailable: 'No disponible',
    timeSlots: 'Franjas horarias',
    addSlot: 'Añadir franja',
    from: 'Desde',
    to: 'Hasta',
nothingMarked: 'Marquen cuándo están ocupados. Hasta entonces, los demás los ven libres.',
    free: 'Libre',
    busy: 'Ocupado',
    partial: 'Parcial',
    legend: 'Leyenda',
    saving: 'Guardando...',
    saved: 'Disponibilidad guardada',
    saveError: 'No se pudo guardar la disponibilidad',
    selectDates: 'Selecciona las fechas',
    busyTime: 'Hora en que estás ocupado',
    fromCalendar: 'Ya hay algo ese día',
    fromDeviceCalendar: 'del calendario',
    fromRehearsal: 'ensayo',
    importedNote: 'Los demás ven estas horas al buscar un hueco. Para liberarlas, elimina el evento en el calendario del teléfono.',
    startTime: 'Hora de inicio',
    endTime: 'Hora de fin',
    deleteData: 'Eliminar datos de esta fecha',
    deleteDataConfirm: '¿Eliminar datos?',
    deleteDataMessage: '¿Seguro que quieres eliminar los datos de disponibilidad de esta fecha pasada?',
    pastDateWarning: 'Esta es una fecha pasada. Puedes eliminar los datos, pero no editarlos.',
    cannotSave: 'No se puede guardar',
    invalidSlot: 'Por favor, corrige las horas de las franjas e inténtalo de nuevo.',
    slotsOverlap: 'Las franjas no deben solaparse',
    slotEndBeforeStart: 'La hora de fin debe ser posterior a la de inicio',
    fixSlots: 'Por favor, corrige las horas de las franjas e inténtalo de nuevo.',
    understood: 'Entendido',
    selectedDates: (count: number) => `Fechas seleccionadas: ${count}`,
    freeAllDay: 'Estás disponible todo el día para ensayar',
    busyAllDay: 'No estás disponible este día',
    allDay: 'Todo el día',
  },
  smartPlanner: {
    title: 'Smart Planner',
    period: 'Período',
    members: 'Miembros',
    recommendations: 'Recomendaciones',
    analyzing: 'Analizando disponibilidad...',
    noSlots: 'Nada que mostrar todavía',
    noSlotsMessage: 'Aquí aparecen las horas en que todos pueden. Para eso hay que marcar el tiempo — o prueben otro período.',
    errorLoading: 'Error al cargar',
    week: 'Semana',
    twoWeeks: 'Dos semanas',
    month: 'Mes',
    custom: 'Elegir fechas',
    customPeriod: 'Período personalizado',
    slotsCount: (count: number) => `${count} ${count === 1 ? 'franja' : 'franjas'}`,
    allDay: 'Todo el día',
    unknownAvailability: (names: string) => `Sin disponibilidad registrada: ${names}. Se cuentan como libres.`,
    addButton: '+ Añadir',
    selectAll: 'Todos',
    clearAll: 'Limpiar',
    selectMembers: 'Miembros',
    applyFilter: 'Aplicar',
    perfect: 'Perfecto',
    good: 'Bueno',
    possible: 'Posible',
    difficult: 'Difícil',
    available: 'Disponibles',
    busy: 'Ocupados',
    selectedMembers: 'seleccionados',
    allMembers: 'Todos los miembros',
    noneSelected: 'Nadie seleccionado',
    allAvailable: 'Todos disponibles',
    allBusy: 'Todos ocupados',
    busyPrefix: 'Ocupados',
    expand: 'Expandir',
    collapse: 'Contraer',
    of: 'de',
    selected: 'seleccionados',
    noMembers: 'No hay miembros',
  },
};

export const de = {
  availability: {
    title: 'Verfügbarkeit',
    available: 'Verfügbar',
    unavailable: 'Nicht verfügbar',
    timeSlots: 'Zeitfenster',
    addSlot: 'Zeitfenster hinzufügen',
    from: 'Von',
    to: 'Bis',
nothingMarked: 'Trag ein, wann du beschäftigt bist. Bis dahin giltst du als frei.',
    free: 'Frei',
    busy: 'Beschäftigt',
    partial: 'Teilweise',
    legend: 'Legende',
    saving: 'Wird gespeichert...',
    saved: 'Verfügbarkeit gespeichert',
    saveError: 'Verfügbarkeit konnte nicht gespeichert werden',
    selectDates: 'Daten auswählen',
    busyTime: 'Beschäftigte Zeit',
    fromCalendar: 'An diesem Tag schon vorhanden',
    fromDeviceCalendar: 'aus dem Kalender',
    fromRehearsal: 'Probe',
    importedNote: 'Diese Zeiten sehen die anderen bei der Terminsuche. Zum Freigeben den Termin im Telefonkalender löschen.',
    startTime: 'Startzeit',
    endTime: 'Endzeit',
    deleteData: 'Daten für dieses Datum löschen',
    deleteDataConfirm: 'Daten löschen?',
    deleteDataMessage: 'Möchtest du die Verfügbarkeitsdaten für dieses vergangene Datum wirklich löschen?',
    pastDateWarning: 'Dies ist ein vergangenes Datum. Du kannst Daten löschen, aber nicht bearbeiten.',
    cannotSave: 'Speichern nicht möglich',
    invalidSlot: 'Bitte korrigiere die Zeitfenster und versuche es erneut.',
    slotsOverlap: 'Zeitfenster dürfen sich nicht überschneiden',
    slotEndBeforeStart: 'Die Endzeit muss nach der Startzeit liegen',
    fixSlots: 'Bitte korrigiere die Zeitfenster und versuche es erneut.',
    understood: 'Verstanden',
    selectedDates: (count: number) => `Ausgewählte Daten: ${count}`,
    freeAllDay: 'Du bist den ganzen Tag für Proben verfügbar',
    busyAllDay: 'Du bist an diesem Tag nicht verfügbar',
    allDay: 'Ganztägig',
  },
  smartPlanner: {
    title: 'Smart Planner',
    period: 'Zeitraum',
    members: 'Mitglieder',
    recommendations: 'Empfehlungen',
    analyzing: 'Verfügbarkeit wird analysiert...',
    noSlots: 'Noch nichts zu zeigen',
    noSlotsMessage: 'Hier erscheinen die Stunden, die allen passen. Dafür müssen die Leute ihre Zeiten eintragen — oder versuch einen anderen Zeitraum.',
    errorLoading: 'Ladefehler',
    week: 'Woche',
    twoWeeks: 'Zwei Wochen',
    month: 'Monat',
    custom: 'Daten auswählen',
    customPeriod: 'Eigener Zeitraum',
    // Zeitfenster is the same in the plural
    slotsCount: (count: number) => `${count} Zeitfenster`,
    allDay: 'Ganztägig',
    unknownAvailability: (names: string) => `Keine Verfügbarkeit hinterlegt: ${names}. Sie zählen als frei.`,
    addButton: '+ Hinzufügen',
    selectAll: 'Alle',
    clearAll: 'Löschen',
    selectMembers: 'Mitglieder',
    applyFilter: 'Anwenden',
    perfect: 'Perfekt',
    good: 'Gut',
    possible: 'Möglich',
    difficult: 'Schwierig',
    available: 'Verfügbar',
    busy: 'Beschäftigt',
    selectedMembers: 'ausgewählt',
    allMembers: 'Alle Mitglieder',
    noneSelected: 'Niemand ausgewählt',
    allAvailable: 'Alle verfügbar',
    allBusy: 'Alle beschäftigt',
    busyPrefix: 'Beschäftigt',
    expand: 'Erweitern',
    collapse: 'Einklappen',
    of: 'von',
    selected: 'ausgewählt',
    noMembers: 'Keine Mitglieder',
  },
};
