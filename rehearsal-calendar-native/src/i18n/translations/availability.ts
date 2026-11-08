export interface AvailabilityTranslations {
  title: string;
  addSlot: string;
  from: string;
  to: string;
  free: string;
  nothingMarked: string;
  /** Shown instead of nothingMarked when the load failed — an empty screen is not proof of an empty diary. */
  couldNotLoad: string;
  /** After why the load failed (requestErrorMessage): what the screen shows instead (T-228). */
  lastLoadedShown: string;
  busy: string;
  partial: string;
  saveError: string;
  busyTime: string;
  /** Heading over the rows the user did not enter: phone-calendar events and rehearsals. */
  fromCalendar: string;
  fromDeviceCalendar: string;
  fromRehearsal: string;
  /** The morning end of the person's own slot from the evening before. */
  fromPreviousDay: string;
  /** Beside a slot's end that is on the next day. */
  nextDay: string;
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
  slotSameStartEnd: string;
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
  recommendations: string;
  analyzing: string;
  noSlots: string;
  noSlotsMessage: string;
  errorLoading: string;
  week: string;
  month: string;
  custom: string;
  customPeriod: string;
  slotsCount: (count: number) => string;
  allDay: string;
  /** Named members who have never recorded availability and so count as free. */
  unknownAvailability: (names: string) => string;
  addButton: string;
  allMembers: string;
  allAvailable: string;
  allBusy: string;
  busyPrefix: string;
}

export const ru = {
  availability: {
    title: 'Занятость',
    addSlot: 'Добавить слот',
    from: 'С',
    to: 'До',
nothingMarked: 'Отметьте, когда вы заняты. Пока вы этого не сделали, вас считают свободным.',
    couldNotLoad: 'Нет связи. Показано последнее, что удалось загрузить — ваши отметки на месте.',
    lastLoadedShown: 'Показано последнее, что удалось загрузить — ваши отметки на месте.',
    free: 'Свободен',
    busy: 'Занят',
    partial: 'Частично',
    saveError: 'Не удалось сохранить занятость',
    busyTime: 'Время когда занят',
    fromCalendar: 'Уже есть в этот день',
    fromDeviceCalendar: 'из календаря',
    fromRehearsal: 'репетиция',
    fromPreviousDay: 'с предыдущего дня',
    nextDay: 'след. дня',
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
    slotSameStartEnd: 'Время окончания не может совпадать с началом',
    fixSlots: 'Пожалуйста, исправьте время слотов и попробуйте снова.',
    understood: 'Понятно',
    selectedDates: (count: number) => `Выбрано дат: ${count}`,
    freeAllDay: 'Вы доступны весь день для репетиций',
    busyAllDay: 'Вы недоступны в этот день',
    allDay: 'Весь день',
  },
  smartPlanner: {
    title: 'Smart Planner',
    recommendations: 'Рекомендации',
    analyzing: 'Анализируем доступность...',
    noSlots: 'Пока показывать нечего',
    noSlotsMessage: 'Здесь появляются часы, когда свободна вся команда. Для этого участники должны отметить свою занятость — или попробуйте другой период.',
    errorLoading: 'Ошибка загрузки',
    week: 'Неделя',
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
    allMembers: 'Все участники',
    allAvailable: 'Все свободны',
    allBusy: 'Все заняты',
    busyPrefix: 'Заняты',
  },
};

export const en = {
  availability: {
    title: 'Availability',
    addSlot: 'Add slot',
    from: 'From',
    to: 'To',
nothingMarked: 'Mark when you are busy. Until you do, everyone sees you as free.',
    couldNotLoad: 'No connection. Showing the last that loaded — your entries are safe.',
    lastLoadedShown: 'Showing the last that loaded — your entries are safe.',
    free: 'Free',
    busy: 'Busy',
    partial: 'Partial',
    saveError: 'Failed to save availability',
    busyTime: 'Busy time',
    fromCalendar: 'Already on this day',
    fromDeviceCalendar: 'from calendar',
    fromRehearsal: 'rehearsal',
    fromPreviousDay: 'from the day before',
    nextDay: 'next day',
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
    slotSameStartEnd: 'End time cannot be the same as the start time',
    fixSlots: 'Please fix the time slots and try again.',
    understood: 'Understood',
    selectedDates: (count: number) => `Selected dates: ${count}`,
    freeAllDay: 'You are available all day for rehearsals',
    busyAllDay: 'You are unavailable on this day',
    allDay: 'All day',
  },
  smartPlanner: {
    title: 'Smart Planner',
    recommendations: 'Recommendations',
    analyzing: 'Analyzing availability...',
    noSlots: 'Nothing to show yet',
    noSlotsMessage: 'This is where the hours everyone can make show up. For that, people have to mark their time — or try another period.',
    errorLoading: 'Error loading',
    week: 'Week',
    month: 'Month',
    custom: 'Select Dates',
    customPeriod: 'Custom Period',
    slotsCount: (count: number) => `${count} ${count === 1 ? 'slot' : 'slots'}`,
    allDay: 'All day',
    unknownAvailability: (names: string) => `No availability recorded: ${names}. They are counted as free.`,
    addButton: '+ Add',
    allMembers: 'All Members',
    allAvailable: 'All available',
    allBusy: 'All busy',
    busyPrefix: 'Busy',
  },
};

export const es = {
  availability: {
    title: 'Disponibilidad',
    addSlot: 'Añadir franja',
    from: 'Desde',
    to: 'Hasta',
nothingMarked: 'Marquen cuándo están ocupados. Hasta entonces, los demás los ven libres.',
    couldNotLoad: 'Sin conexión. Se muestra lo último que se cargó — tus marcas están a salvo.',
    lastLoadedShown: 'Se muestra lo último que se cargó — tus marcas están a salvo.',
    free: 'Libre',
    busy: 'Ocupado',
    partial: 'Parcial',
    saveError: 'No se pudo guardar la disponibilidad',
    busyTime: 'Hora en que estás ocupado',
    fromCalendar: 'Ya hay algo ese día',
    fromDeviceCalendar: 'del calendario',
    fromRehearsal: 'ensayo',
    fromPreviousDay: 'del día anterior',
    nextDay: 'día sig.',
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
    slotSameStartEnd: 'La hora de fin no puede ser igual a la de inicio',
    fixSlots: 'Por favor, corrige las horas de las franjas e inténtalo de nuevo.',
    understood: 'Entendido',
    selectedDates: (count: number) => `Fechas seleccionadas: ${count}`,
    freeAllDay: 'Estás disponible todo el día para ensayar',
    busyAllDay: 'No estás disponible este día',
    allDay: 'Todo el día',
  },
  smartPlanner: {
    title: 'Smart Planner',
    recommendations: 'Recomendaciones',
    analyzing: 'Analizando disponibilidad...',
    noSlots: 'Nada que mostrar todavía',
    noSlotsMessage: 'Aquí aparecen las horas en que todos pueden. Para eso hay que marcar el tiempo — o prueben otro período.',
    errorLoading: 'Error al cargar',
    week: 'Semana',
    month: 'Mes',
    custom: 'Elegir fechas',
    customPeriod: 'Período personalizado',
    slotsCount: (count: number) => `${count} ${count === 1 ? 'franja' : 'franjas'}`,
    allDay: 'Todo el día',
    unknownAvailability: (names: string) => `Sin disponibilidad registrada: ${names}. Se cuentan como libres.`,
    addButton: '+ Añadir',
    allMembers: 'Todos los miembros',
    allAvailable: 'Todos disponibles',
    allBusy: 'Todos ocupados',
    busyPrefix: 'Ocupados',
  },
};

export const de = {
  availability: {
    title: 'Verfügbarkeit',
    addSlot: 'Zeitfenster hinzufügen',
    from: 'Von',
    to: 'Bis',
nothingMarked: 'Trag ein, wann du beschäftigt bist. Bis dahin giltst du als frei.',
    couldNotLoad: 'Keine Verbindung. Angezeigt wird der letzte geladene Stand — deine Einträge sind sicher.',
    lastLoadedShown: 'Angezeigt wird der letzte geladene Stand — deine Einträge sind sicher.',
    free: 'Frei',
    busy: 'Beschäftigt',
    partial: 'Teilweise',
    saveError: 'Verfügbarkeit konnte nicht gespeichert werden',
    busyTime: 'Beschäftigte Zeit',
    fromCalendar: 'An diesem Tag schon vorhanden',
    fromDeviceCalendar: 'aus dem Kalender',
    fromRehearsal: 'Probe',
    fromPreviousDay: 'vom Vortag',
    nextDay: 'Folgetag',
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
    slotSameStartEnd: 'Die Endzeit darf nicht gleich der Startzeit sein',
    fixSlots: 'Bitte korrigiere die Zeitfenster und versuche es erneut.',
    understood: 'Verstanden',
    selectedDates: (count: number) => `Ausgewählte Daten: ${count}`,
    freeAllDay: 'Du bist den ganzen Tag für Proben verfügbar',
    busyAllDay: 'Du bist an diesem Tag nicht verfügbar',
    allDay: 'Ganztägig',
  },
  smartPlanner: {
    title: 'Smart Planner',
    recommendations: 'Empfehlungen',
    analyzing: 'Verfügbarkeit wird analysiert...',
    noSlots: 'Noch nichts zu zeigen',
    noSlotsMessage: 'Hier erscheinen die Stunden, die allen passen. Dafür müssen die Leute ihre Zeiten eintragen — oder versuch einen anderen Zeitraum.',
    errorLoading: 'Ladefehler',
    week: 'Woche',
    month: 'Monat',
    custom: 'Daten auswählen',
    customPeriod: 'Eigener Zeitraum',
    // Zeitfenster is the same in the plural
    slotsCount: (count: number) => `${count} Zeitfenster`,
    allDay: 'Ganztägig',
    unknownAvailability: (names: string) => `Keine Verfügbarkeit hinterlegt: ${names}. Sie zählen als frei.`,
    addButton: '+ Hinzufügen',
    allMembers: 'Alle Mitglieder',
    allAvailable: 'Alle verfügbar',
    allBusy: 'Alle beschäftigt',
    busyPrefix: 'Beschäftigt',
  },
};
