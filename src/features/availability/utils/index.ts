/**
 * Export all availability utils
 */

// Calendar utilities - все функции для работы с календарем
export {
  generateMonths,
  getDaysInMonth,
  formatDate,
  getDayStatus,
  calculateDateOffset,
} from './calendarUtils';

// Validation utilities
export {
  timeToMinutes,
  validateSlot,
  slotsOverlap,
  validateSlots,
} from './validationUtils';

// Slot helper utilities
export {
  applyToSelectedDates,
  parseTimeToDate,
  formatDateToTime,
} from './slotHelpers';
