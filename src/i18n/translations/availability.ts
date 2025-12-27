export interface AvailabilityTranslations {
  title: string;
  available: string;
  unavailable: string;
  timeSlots: string;
  addSlot: string;
  from: string;
  to: string;
  free: string;
  busy: string;
  partial: string;
  legend: string;
  saving: string;
  saved: string;
  saveError: string;
  selectDates: string;
  busyTime: string;
  startTime: string;
  endTime: string;
  deleteData: string;
  deleteDataConfirm: string;
  deleteDataMessage: string;
  pastDateWarning: string;
  cannotSave: string;
  invalidSlot: string;
  slotsOverlap: string;
  fixSlots: string;
  understood: string;
  selectedDates: (count: number) => string;
  freeAllDay: string;
  busyAllDay: string;
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
  slots: string;
  allDay: string;
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
    free: 'Свободен',
    busy: 'Занят',
    partial: 'Частично',
    legend: 'Легенда',
    saving: 'Сохранение...',
    saved: 'Занятость сохранена',
    saveError: 'Не удалось сохранить занятость',
    selectDates: 'Выберите даты',
    busyTime: 'Время когда занят',
    startTime: 'Время начала',
    endTime: 'Время окончания',
    deleteData: 'Удалить данные этой даты',
    deleteDataConfirm: 'Удалить данные?',
    deleteDataMessage: 'Вы уверены, что хотите удалить данные занятости для этой прошедшей даты?',
    pastDateWarning: 'Это прошедшая дата. Вы можете удалить данные, но не редактировать.',
    cannotSave: 'Невозможно сохранить',
    invalidSlot: 'Пожалуйста, исправьте время слотов и попробуйте снова.',
    slotsOverlap: 'Слоты не должны пересекаться',
    fixSlots: 'Пожалуйста, исправьте время слотов и попробуйте снова.',
    understood: 'Понятно',
    selectedDates: (count: number) => `Выбрано дат: ${count}`,
    freeAllDay: 'Вы доступны весь день для репетиций',
    busyAllDay: 'Вы недоступны в этот день',
  },
  smartPlanner: {
    title: 'Smart Planner',
    period: 'Период',
    members: 'Участники',
    recommendations: 'Рекомендации',
    analyzing: 'Анализируем доступность...',
    noSlots: 'Нет доступных слотов',
    noSlotsMessage: 'Попробуйте выбрать другой период или участников',
    errorLoading: 'Ошибка загрузки',
    week: 'Неделя',
    twoWeeks: 'Две недели',
    month: 'Месяц',
    custom: 'Свой',
    customPeriod: 'Свой период',
    slots: 'слотов',
    allDay: 'Весь день',
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
    free: 'Free',
    busy: 'Busy',
    partial: 'Partial',
    legend: 'Legend',
    saving: 'Saving...',
    saved: 'Availability saved',
    saveError: 'Failed to save availability',
    selectDates: 'Select dates',
    busyTime: 'Busy time',
    startTime: 'Start time',
    endTime: 'End time',
    deleteData: 'Delete this date data',
    deleteDataConfirm: 'Delete data?',
    deleteDataMessage: 'Are you sure you want to delete availability data for this past date?',
    pastDateWarning: 'This is a past date. You can delete data, but not edit.',
    cannotSave: 'Cannot save',
    invalidSlot: 'Please fix the time slots and try again.',
    slotsOverlap: 'Slots must not overlap',
    fixSlots: 'Please fix the time slots and try again.',
    understood: 'Understood',
    selectedDates: (count: number) => `Selected dates: ${count}`,
    freeAllDay: 'You are available all day for rehearsals',
    busyAllDay: 'You are unavailable on this day',
  },
  smartPlanner: {
    title: 'Smart Planner',
    period: 'Period',
    members: 'Members',
    recommendations: 'Recommendations',
    analyzing: 'Analyzing availability...',
    noSlots: 'No available slots',
    noSlotsMessage: 'Try selecting a different period or members',
    errorLoading: 'Error loading',
    week: 'Week',
    twoWeeks: 'Two Weeks',
    month: 'Month',
    custom: 'Custom',
    customPeriod: 'Custom Period',
    slots: 'slots',
    allDay: 'All day',
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
  },
};
