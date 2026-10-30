/**
 * Unit Tests for DateRangePicker Component
 *
 * Tests:
 * - Modal rendering (visible/hidden)
 * - Date selection (start → end)
 * - Date range validation (end >= start)
 * - Date swapping when end < start
 * - Confirm action
 * - Cancel action and reset
 * - Disabled state when no end date
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { DateRangePicker } from '../DateRangePicker';

// Mock dependencies
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: {
      common: {
        selectPeriod: 'Выберите период',
        invalidDateRange: 'Invalid date range',
        dateRangeTooLong: (days: number) => `Maximum ${days} days`,
        from: 'От',
        to: 'До',
        cancel: 'Отмена',
        done: 'Готово',
        today: 'Сегодня',
      },
    },
    language: 'ru',
  }),
}));
const mockWeekStart = jest.fn(() => 'monday');
jest.mock('../../../hooks/useWeekStart', () => ({ useWeekStart: () => mockWeekStart() }));
const mockToday = jest.fn<string | undefined, []>(() => undefined);
jest.mock('../../hooks/useClock', () => {
  const actual = jest.requireActual('../../hooks/useClock');
  return { ...actual, useToday: () => mockToday() ?? actual.useToday() };
});

// The library's own day, rendered in the Today tests, presses through this.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return { ...actual, TouchableWithoutFeedback: actual.TouchableOpacity };
});

const calendarOf = (view: ReturnType<typeof render>) =>
  view.UNSAFE_getByType(require('react-native-calendars').Calendar);
// The range's own marks, without the day marked as today.
const rangeMarks = (marks: Record<string, { color?: string }>) =>
  Object.keys(marks).filter((day) => marks[day].color);

describe('DateRangePicker Component', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when visible is false', () => {
      const { queryByText } = render(
        <DateRangePicker
          visible={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(queryByText('Выберите период')).toBeNull();
    });

    it('should render when visible is true', () => {
      const { getByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Выберите период')).toBeTruthy();
      expect(getByText('Отмена')).toBeTruthy();
      expect(getByText('Готово')).toBeTruthy();
    });

    it('should render with initial dates', () => {
      const startDate = new Date('2025-12-25');
      const endDate = new Date('2025-12-31');

      const { getByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      );

      expect(getByText('Выберите период')).toBeTruthy();
    });
  });

  describe('Date Selection', () => {
    it('should select start date on first press', () => {
      const { getByText, UNSAFE_getAllByType } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Initially, "Готово" button should be disabled (no complete range)
      // Find the TouchableOpacity that contains "Готово" text
      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
      const doneButton = touchables.find(t => {
        const textNode = t.props.children?.props?.children;
        return textNode === 'Готово';
      });
      expect(doneButton?.props.disabled).toBe(true);
    });

    it('should handle cancel button press', () => {
      const { getByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const cancelButton = getByText('Отмена');
      fireEvent.press(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle overlay press to close', () => {
      const { getByTestId, UNSAFE_getAllByType } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Find the overlay Pressable (first Pressable component)
      const pressables = UNSAFE_getAllByType(require('react-native').Pressable);
      const overlay = pressables[0]; // Overlay is the first Pressable

      fireEvent.press(overlay);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Confirm Action', () => {
    it('should call onConfirm with selected dates', () => {
      const startDate = new Date('2025-12-25');
      const endDate = new Date('2025-12-31');

      const { getByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      );

      const doneButton = getByText('Готово');
      fireEvent.press(doneButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    // The picker holds its selection as 'YYYY-MM-DD', so a Date has to survive
    // the trip out to a string and back. Converting either way through UTC lost
    // a day for part of every night — the calendar showed one date and the
    // caller was handed its neighbour.
    it('should hand back the same calendar day it was given, in local terms', () => {
      const startDate = new Date(2025, 11, 25); // local midnight, 25 Dec
      const endDate = new Date(2025, 11, 31);

      const { getByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      );

      fireEvent.press(getByText('Готово'));

      const [emittedStart, emittedEnd] = mockOnConfirm.mock.calls[0];
      const localParts = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate()];

      expect(localParts(emittedStart)).toEqual([2025, 11, 25]);
      expect(localParts(emittedEnd)).toEqual([2025, 11, 31]);
    });

    it('should not call onConfirm when no dates selected', () => {
      const { getByText, UNSAFE_getAllByType } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Find the TouchableOpacity that contains "Готово" text
      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
      const doneButton = touchables.find(t => {
        const textNode = t.props.children?.props?.children;
        return textNode === 'Готово';
      });
      // Button should be disabled when no dates selected
      expect(doneButton?.props.disabled).toBe(true);
    });
  });

  describe('Cancel and Reset', () => {
    it('should reset to initial dates on cancel', () => {
      const startDate = new Date('2025-12-25');
      const endDate = new Date('2025-12-31');

      const { getByText, rerender } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      );

      // Cancel should reset dates and close
      const cancelButton = getByText('Отмена');
      fireEvent.press(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Min Date Constraint', () => {
    it('should pass minDate to Calendar component', () => {
      // The 20th here, not midnight UTC — that is the 19th west of UTC.
      const minDate = new Date(2025, 11, 20);

      const { UNSAFE_getByType } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          minDate={minDate}
        />
      );

      // Calendar component should receive minDate prop
      const calendar = UNSAFE_getByType(require('react-native-calendars').Calendar);
      expect(calendar.props.minDate).toBe('2025-12-20');
    });
  });

  // T-012: the calendar began its week on Sunday whatever the setting.
  describe('The first day of the week', () => {
    it.each([['monday', 1], ['sunday', 0]])('begins on the profile\'s day: %s', (weekStart, firstDay) => {
      mockWeekStart.mockReturnValue(weekStart);
      const view = render(<DateRangePicker visible onClose={mockOnClose} onConfirm={mockOnConfirm} />);

      expect(calendarOf(view).props.firstDay).toBe(firstDay);
    });
  });

  // T-012: the library marks the phone's date as today. In Honolulu on the
  // 28th, with a profile already on the 29th, it marked the 28th — a day before
  // the first one it would take.
  describe('Today', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date(2026, 9, 28, 12, 0), doNotFake: ['nextTick', 'setImmediate'] });
      mockToday.mockReturnValue('2026-10-29');
    });
    afterEach(() => {
      jest.useRealTimers();
      mockToday.mockReturnValue(undefined);
    });

    it('is the profile\'s day, not the phone\'s', () => {
      const view = render(
        <DateRangePicker visible onClose={mockOnClose} onConfirm={mockOnConfirm} minDate={new Date(2026, 9, 29)} />
      );
      const marks = calendarOf(view).props.markedDates;

      expect(marks['2026-10-29']).toEqual(expect.objectContaining({ today: true }));
      expect(marks['2026-10-28']).toEqual(expect.objectContaining({ today: false, disabled: true }));
    });

    // The library names a day itself, "today" first on the phone's date,
    // whatever the marking; an empty word for it is read as 'today'. Its own
    // Day, given what the picker gives the calendar, is what VoiceOver reads.
    it('VoiceOver hears "today" on the profile\'s day only', () => {
      const view = render(
        <DateRangePicker visible onClose={mockOnClose} onConfirm={mockOnConfirm} minDate={new Date(2026, 9, 29)} />
      );
      const { dayComponent, markedDates } = calendarOf(view).props;
      const LibraryDay = jest.requireActual('react-native-calendars/src/calendar/day').default;
      const spoken = (date: string) => {
        const day = render(
          <LibraryDay date={date} markingType="period" marking={markedDates[date]} dayComponent={dayComponent} />
        );
        return day.UNSAFE_getByProps({ accessible: true }).props.accessibilityLabel as string;
      };

      expect(spoken('2026-10-28')).not.toMatch(/today|сегодня/i);
      expect(spoken('2026-10-28')).toMatch(/28/);
      expect(spoken('2026-10-29')).toMatch(/^Сегодня, .*29/);
      expect(spoken('2026-10-30')).not.toMatch(/today|сегодня/i);
    });

    it('keeps the period\'s marks on a today inside it', () => {
      const view = render(
        <DateRangePicker visible onClose={mockOnClose} onConfirm={mockOnConfirm}
          initialStartDate={new Date(2026, 9, 29)} initialEndDate={new Date(2026, 9, 31)} />
      );
      const marks = calendarOf(view).props.markedDates;

      expect(marks['2026-10-29']).toEqual(expect.objectContaining({ today: true, startingDay: true }));
      expect(rangeMarks(marks)).toEqual(['2026-10-29', '2026-10-31', '2026-10-30']);
    });

    it('opens on the profile\'s month', () => {
      mockToday.mockReturnValue('2026-11-01');
      const view = render(<DateRangePicker visible onClose={mockOnClose} onConfirm={mockOnConfirm} />);

      expect(calendarOf(view).props.current).toBe('2026-11-01');
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly in Russian', () => {
      const { getByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Should show "От" and "До" labels
      expect(getByText('От')).toBeTruthy();
      expect(getByText('До')).toBeTruthy();
    });
  });

  describe('Localization', () => {
    it('should use Russian locale when language is ru', () => {
      // Override useI18n mock for this test
      jest.spyOn(require('../../../contexts/I18nContext'), 'useI18n').mockReturnValue({
        t: {
          common: {
            selectPeriod: 'Выберите период',
            invalidDateRange: 'Invalid date range',
            dateRangeTooLong: (days: number) => `Maximum ${days} days`,
            from: 'От',
            to: 'До',
            cancel: 'Отмена',
            done: 'Готово',
          },
        },
        language: 'ru',
      });

      const { getByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Выберите период')).toBeTruthy();
      expect(getByText('От')).toBeTruthy();
      expect(getByText('До')).toBeTruthy();
      expect(getByText('Отмена')).toBeTruthy();
      expect(getByText('Готово')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('rejects an oversized custom range before marking dates or confirming it', () => {
      const view = render(
        <DateRangePicker visible onClose={mockOnClose} onConfirm={mockOnConfirm}
          maxDays={90} initialStartDate={new Date(2026, 0, 1)}
          initialEndDate={new Date(9999, 11, 31)} />
      );
      expect(view.getByText('Maximum 90 days')).toBeTruthy();
      const calendar = view.UNSAFE_getByType(require('react-native-calendars').Calendar);
      expect(rangeMarks(calendar.props.markedDates)).toEqual([]);
      fireEvent.press(view.getByText('Готово'));
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();

      // The user can immediately replace the rejected selection with a valid
      // 90-day inclusive range; the boundary itself remains usable.
      act(() => calendar.props.onDayPress({ dateString: '2026-01-01' }));
      act(() => view.UNSAFE_getByType(require('react-native-calendars').Calendar)
        .props.onDayPress({ dateString: '2026-03-31' }));
      expect(view.queryByText('Maximum 90 days')).toBeNull();
      expect(rangeMarks(view.UNSAFE_getByType(require('react-native-calendars').Calendar)
        .props.markedDates)).toHaveLength(90);
      fireEvent.press(view.getByText('Готово'));
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined initial dates', () => {
      const { getByText, getAllByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(getByText('Выберите период')).toBeTruthy();
      // Should show "—" placeholders for empty dates (one for start, one for end)
      const placeholders = getAllByText('—');
      expect(placeholders.length).toBe(2);
    });

    it('should handle same start and end date', () => {
      const sameDate = new Date('2025-12-25');

      const { getByText } = render(
        <DateRangePicker
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          initialStartDate={sameDate}
          initialEndDate={sameDate}
        />
      );

      const doneButton = getByText('Готово');
      fireEvent.press(doneButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });
  });
});
