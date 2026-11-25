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
  /**
   * In the editor, on a weekend busy by default rather than by the person
   * (T-406); `path` is where the default is turned off, as the Profile labels it.
   */
  weekendDefault: (path: string) => string;
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
  /** The period's third segment, beside Week and Month: dates of one's own (T-241). */
  dates: string;
  slotsCount: (count: number) => string;
  allDay: string;
  /** Named members who have never recorded availability and so count as free. */
  unknownAvailability: (names: string) => string;
  /** A slot's "+", read aloud: what it does and when (T-241). */
  addRehearsalAt: (time: string) => string;
  allMembers: string;
  allAvailable: string;
  allBusy: string;
  /** Before a slot's busy names: agrees with how many they are (T-258). */
  busyPrefix: (count: number) => string;
}

export const ru = {
  availability: {
    title: 'Занятость',
    addSlot: 'Добавить время',
    from: 'С',
    to: 'До',
    nothingMarked: 'Отметьте, когда вы заняты. Пока отметок нет, для остальных вы свободны.',
    couldNotLoad: 'Нет связи. Показано последнее, что удалось загрузить — ваши отметки на месте.',
    lastLoadedShown: 'Показано последнее, что удалось загрузить — ваши отметки на месте.',
    // The state of a day, not of a person: no gender to guess.
    free: 'Свободно',
    busy: 'Занято',
    partial: 'Частично',
    saveError: 'Не удалось сохранить занятость',
    busyTime: 'Время занятости',
    fromCalendar: 'Уже есть в этот день',
    fromDeviceCalendar: 'из календаря',
    fromRehearsal: 'репетиция',
    fromPreviousDay: 'с предыдущего дня',
    nextDay: 'след. дня',
    importedNote: 'Эти часы видят остальные, когда подбирают время. Чтобы освободить их, удалите событие в календаре телефона.',
    // T-406: new, for the native speakers' reading.
    weekendDefault: (path: string) => `Выходной: занят по умолчанию. Его, как любой день, можно отметить иначе, а выключить это сразу для всех выходных: ${path}.`,
    startTime: 'Время начала',
    endTime: 'Время окончания',
    deleteData: 'Удалить отметки за этот день',
    deleteDataConfirm: 'Удалить отметки?',
    deleteDataMessage: 'Отметки занятости за этот прошедший день будут удалены.',
    pastDateWarning: 'Этот день уже прошёл. Отметки можно удалить, но не изменить.',
    cannotSave: 'Невозможно сохранить',
    invalidSlot: 'Исправьте время и попробуйте снова.',
    slotsOverlap: 'Промежутки времени не должны пересекаться',
    slotSameStartEnd: 'Время окончания не может совпадать со временем начала',
    fixSlots: 'Исправьте время и попробуйте снова.',
    understood: 'Понятно',
    selectedDates: (count: number) => `Выбрано дат: ${count}`,
    freeAllDay: 'Весь день вы свободны для репетиций',
    busyAllDay: 'В этот день вы заняты',
    allDay: 'Весь день',
  },
  smartPlanner: {
    title: 'Smart Planner',
    recommendations: 'Рекомендации',
    analyzing: 'Смотрим, кто свободен…',
    noSlots: 'Пока показывать нечего',
    noSlotsMessage: 'Здесь появляются часы, когда свободны все участники. Для этого им нужно отметить занятость. Или попробуйте другой период.',
    errorLoading: 'Ошибка загрузки',
    week: 'Неделя',
    month: 'Месяц',
    dates: 'Даты',
    slotsCount: (count: number) => {
      // 1 вариант, 2 варианта, 5 вариантов — и 11..14 идут по последней форме
      const mod10 = count % 10;
      const mod100 = count % 100;
      if (mod10 === 1 && mod100 !== 11) return `${count} вариант`;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} варианта`;
      return `${count} вариантов`;
    },
    allDay: 'Весь день',
    unknownAvailability: (names: string) => `Нет данных о занятости: ${names}. Без отметок участник считается свободным.`,
    addRehearsalAt: (time: string) => `Добавить репетицию ${time}`,
    allMembers: 'Все участники',
    allAvailable: 'Все свободны',
    allBusy: 'Все заняты',
    // "не может" has no gender, as busyAtThisTime; "Заняты" was plural for one.
    busyPrefix: (count: number) => (count === 1 ? 'Не может' : 'Не могут'),
  },
};

export const en = {
  availability: {
    title: 'Availability',
    addSlot: 'Add Slot',
    from: 'From',
    to: 'To',
    nothingMarked: 'Mark when you are busy. Until you do, everyone sees you as free.',
    couldNotLoad: 'Could not connect. Showing what was last loaded — your entries are safe.',
    lastLoadedShown: 'Showing what was last loaded — your entries are safe.',
    free: 'Free',
    busy: 'Busy',
    partial: 'Partial',
    saveError: 'Could not save your availability',
    busyTime: 'Busy Time',
    fromCalendar: 'Already Scheduled',
    fromDeviceCalendar: 'from calendar',
    fromRehearsal: 'rehearsal',
    fromPreviousDay: 'from the day before',
    nextDay: 'next day',
    importedNote: 'Everyone else sees these hours when looking for a time. To free them up, delete the event in your phone calendar.',
    // T-406: new, for the native speakers' reading.
    weekendDefault: (path: string) => `Weekend day: busy by default. Change it like any other day, or turn off the default for all weekends in ${path}.`,
    startTime: 'Start Time',
    endTime: 'End Time',
    deleteData: 'Delete This Day’s Entries',
    deleteDataConfirm: 'Delete Entries?',
    deleteDataMessage: 'Your availability entries for this past day will be deleted.',
    pastDateWarning: 'This day has passed. You can delete its entries but not edit them.',
    cannotSave: 'Cannot Save',
    invalidSlot: 'Please fix the time slots and try again.',
    slotsOverlap: 'Slots must not overlap',
    slotSameStartEnd: 'End time cannot be the same as the start time',
    fixSlots: 'Please fix the time slots and try again.',
    understood: 'OK',
    selectedDates: (count: number) => `Selected dates: ${count}`,
    freeAllDay: 'You are free all day for rehearsals',
    busyAllDay: 'You are busy all day',
    allDay: 'All day',
  },
  smartPlanner: {
    title: 'Smart Planner',
    recommendations: 'Recommendations',
    analyzing: 'Analyzing availability…',
    noSlots: 'Nothing to Show Yet',
    noSlotsMessage: 'Hours when everyone is free show up here once people mark when they are busy. You can also try different dates.',
    errorLoading: 'Could not load availability',
    week: 'Week',
    month: 'Month',
    dates: 'Dates',
    slotsCount: (count: number) => `${count} ${count === 1 ? 'slot' : 'slots'}`,
    allDay: 'All day',
    unknownAvailability: (names: string) => `No availability recorded: ${names}. They are counted as free.`,
    addRehearsalAt: (time: string) => `Add rehearsal, ${time}`,
    allMembers: 'All participants',
    allAvailable: 'All available',
    allBusy: 'All busy',
    busyPrefix: () => 'Busy',
  },
};

export const es = {
  availability: {
    title: 'Disponibilidad',
    addSlot: 'Añadir franja',
    from: 'Desde',
    to: 'Hasta',
    nothingMarked: 'Marca las horas en que no puedes. Mientras no marques nada, los demás te verán libre.',
    couldNotLoad: 'Sin conexión. Se muestra lo último que se cargó; tus marcas están a salvo.',
    lastLoadedShown: 'Se muestra lo último que se cargó; tus marcas están a salvo.',
    free: 'Libre',
    busy: 'Ocupado',
    partial: 'Parcial',
    saveError: 'No se pudo guardar la disponibilidad',
    busyTime: 'Horas ocupadas',
    fromCalendar: 'Ya hay algo ese día',
    fromDeviceCalendar: 'del calendario',
    fromRehearsal: 'ensayo',
    fromPreviousDay: 'del día anterior',
    nextDay: 'día sig.',
    importedNote: 'Los demás ven estas horas cuando buscan un horario. Para liberarlas, elimina el evento en el calendario del teléfono.',
    // T-406: new, for the native speakers' reading.
    weekendDefault: (path: string) => `Ocupado por defecto: cámbialo como cualquier otro día. Para desactivarlo en todos los fines de semana: ${path}.`,
    startTime: 'Hora de inicio',
    endTime: 'Hora de fin',
    deleteData: 'Eliminar las marcas de este día',
    deleteDataConfirm: '¿Eliminar las marcas?',
    deleteDataMessage: 'Se eliminarán tus marcas de este día, que ya pasó.',
    pastDateWarning: 'Este día ya pasó. Puedes eliminar sus marcas, pero no cambiarlas.',
    cannotSave: 'No se puede guardar',
    invalidSlot: 'Por favor, corrige las horas de las franjas e inténtalo de nuevo.',
    slotsOverlap: 'Las franjas no pueden superponerse',
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
    analyzing: 'Viendo quién está libre…',
    noSlots: 'Nada que mostrar todavía',
    noSlotsMessage: 'Aquí aparecen las horas en que todos pueden. Para eso, cada uno tiene que marcar sus horas ocupadas. También puedes probar con otro período.',
    errorLoading: 'Error al cargar',
    week: 'Semana',
    month: 'Mes',
    dates: 'Fechas',
    slotsCount: (count: number) => `${count} ${count === 1 ? 'franja' : 'franjas'}`,
    allDay: 'Todo el día',
    unknownAvailability: (names: string) => `Sin datos de disponibilidad: ${names}. Quien no marca nada cuenta como libre.`,
    addRehearsalAt: (time: string) => `Añadir ensayo ${time}`,
    allMembers: 'Todos los participantes',
    allAvailable: 'Todos disponibles',
    allBusy: 'Todos ocupados',
    // "No disponible(s)" has no gender; "Ocupados" guessed one, and the plural.
    busyPrefix: (count: number) => (count === 1 ? 'No disponible' : 'No disponibles'),
  },
};

export const de = {
  availability: {
    title: 'Verfügbarkeit',
    addSlot: 'Zeitfenster hinzufügen',
    from: 'Von',
    to: 'Bis',
    nothingMarked: 'Trag ein, wann du beschäftigt bist. Bis dahin giltst du als frei.',
    couldNotLoad: 'Keine Verbindung. Angezeigt wird der letzte geladene Stand – deine Einträge sind sicher.',
    lastLoadedShown: 'Angezeigt wird der letzte geladene Stand – deine Einträge sind sicher.',
    free: 'Frei',
    busy: 'Beschäftigt',
    partial: 'Teilweise',
    saveError: 'Verfügbarkeit konnte nicht gespeichert werden',
    busyTime: 'Belegte Zeit',
    fromCalendar: 'An diesem Tag schon vorhanden',
    fromDeviceCalendar: 'aus dem Kalender',
    fromRehearsal: 'Probe',
    fromPreviousDay: 'vom Vortag',
    // In the end's button beside its time; one line even beside "1:00 AM" (flow 87).
    nextDay: 'am Folgetag',
    importedNote: 'Diese Zeiten sehen die anderen bei der Terminsuche. Um sie freizugeben, lösche den Termin in deiner Kalender-App.',
    // T-406: new, for the native speakers' reading.
    weekendDefault: (path: string) => `Wochenendtag: standardmäßig belegt. Ändere ihn wie jeden anderen Tag oder schalte das für alle Wochenenden aus: ${path}.`,
    startTime: 'Startzeit',
    endTime: 'Endzeit',
    deleteData: 'Einträge für diesen Tag löschen',
    deleteDataConfirm: 'Einträge löschen?',
    deleteDataMessage: 'Deine Einträge für diesen vergangenen Tag werden gelöscht.',
    pastDateWarning: 'Dieser Tag ist vorbei. Du kannst die Einträge löschen, aber nicht mehr ändern.',
    cannotSave: 'Speichern nicht möglich',
    invalidSlot: 'Bitte korrigiere die Zeitfenster und versuche es erneut.',
    slotsOverlap: 'Zeitfenster dürfen sich nicht überschneiden',
    slotSameStartEnd: 'Die Endzeit darf nicht gleich der Startzeit sein',
    fixSlots: 'Bitte korrigiere die Zeitfenster und versuche es erneut.',
    understood: 'Verstanden',
    selectedDates: (count: number) => `Ausgewählte Tage: ${count}`,
    freeAllDay: 'Du bist den ganzen Tag für Proben verfügbar',
    busyAllDay: 'Du bist an diesem Tag nicht verfügbar',
    allDay: 'Ganztägig',
  },
  smartPlanner: {
    title: 'Smart Planner',
    recommendations: 'Empfehlungen',
    analyzing: 'Verfügbarkeit wird analysiert …',
    noSlots: 'Noch nichts zu zeigen',
    noSlotsMessage: 'Hier erscheinen die Stunden, die allen passen. Dafür müssen alle eintragen, wann sie beschäftigt sind – oder wähle einen anderen Zeitraum.',
    errorLoading: 'Ladefehler',
    week: 'Woche',
    month: 'Monat',
    dates: 'Tage',
    // Zeitfenster is the same in the plural
    slotsCount: (count: number) => `${count} Zeitfenster`,
    allDay: 'Ganztägig',
    unknownAvailability: (names: string) => `Keine Verfügbarkeit hinterlegt: ${names}. Wer nichts eingetragen hat, zählt als frei.`,
    addRehearsalAt: (time: string) => `Probe für ${time} hinzufügen`,
    allMembers: 'Alle Teilnehmer',
    allAvailable: 'Alle verfügbar',
    allBusy: 'Alle beschäftigt',
    busyPrefix: () => 'Beschäftigt',
  },
};
