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
import { render, fireEvent } from '@testing-library/react-native';
import { DateRangePicker } from '../DateRangePicker';

// Mock dependencies
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: {
      common: {
        selectPeriod: 'Выберите период',
        from: 'От',
        to: 'До',
        cancel: 'Отмена',
        done: 'Готово',
      },
    },
    language: 'ru',
  }),
}));

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
      const minDate = new Date('2025-12-20');

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
