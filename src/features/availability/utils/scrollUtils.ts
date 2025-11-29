import { Spacing } from '../../../shared/constants/colors';
import {
  MONTH_TITLE_HEIGHT,
  WEEKDAY_ROW_HEIGHT,
  DAY_ROW_HEIGHT
} from '../constants';

// Calculate scroll offset for a specific date
export const calculateDateOffset = (
  targetYear: number,
  targetMonth: number,
  targetDay: number,
  months: { year: number; month: number; key: string }[]
) => {
  let offset = Spacing.xl; // Initial padding

  for (let i = 0; i < months.length; i++) {
    const m = months[i];

    if (m.year === targetYear && m.month === targetMonth - 1) {
      // Found the month, now calculate position within it
      offset += MONTH_TITLE_HEIGHT;
      offset += WEEKDAY_ROW_HEIGHT;

      // Calculate which row the day is in
      const firstDay = new Date(m.year, m.month, 1);
      let startDayOfWeek = firstDay.getDay() - 1;
      if (startDayOfWeek < 0) startDayOfWeek = 6;

      const dayIndex = startDayOfWeek + targetDay - 1;
      const rowIndex = Math.floor(dayIndex / 7);

      offset += rowIndex * DAY_ROW_HEIGHT;

      return offset;
    }

    // Add height of this month
    const firstDay = new Date(m.year, m.month, 1);
    const lastDay = new Date(m.year, m.month + 1, 0);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const totalCells = startDayOfWeek + lastDay.getDate();
    const numRows = Math.ceil(totalCells / 7);

    const monthHeight = MONTH_TITLE_HEIGHT + WEEKDAY_ROW_HEIGHT + (numRows * DAY_ROW_HEIGHT) + Spacing.xl;
    offset += monthHeight;
  }

  return offset;
};
