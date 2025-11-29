/**
 * Constants for Availability feature
 */
import { Dimensions } from 'react-native';
import { FontSize, Spacing } from '../../../shared/constants/colors';
import { TimeSlot } from '../types/availability';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const DAY_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.xs * 6) / 7;

// Calculate month height for scroll calculations
export const MONTH_TITLE_HEIGHT = FontSize.lg + Spacing.md; // Title + marginBottom
export const WEEKDAY_ROW_HEIGHT = FontSize.xs + Spacing.sm; // Labels + marginBottom
export const DAY_ROW_HEIGHT = DAY_SIZE + Spacing.xs; // Day cell + marginBottom

export const PANEL_HEIGHT = 320;

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const DEFAULT_SLOT: TimeSlot = { start: '10:00', end: '18:00' };
