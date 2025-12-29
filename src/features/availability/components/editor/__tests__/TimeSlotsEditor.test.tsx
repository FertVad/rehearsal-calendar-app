/**
 * Unit Tests for TimeSlotsEditor Component
 *
 * Tests:
 * - Slots rendering
 * - Add slot button
 * - Remove slot button (only when >1 slot)
 * - Time picker opening for start/end
 * - Validation error display
 * - Time value display
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TimeSlotsEditor from '../TimeSlotsEditor';
import { TimeSlot } from '../../../types/availability';

describe('TimeSlotsEditor Component', () => {
  const mockOnSlotChange = jest.fn();
  const mockOnAddSlot = jest.fn();
  const mockOnRemoveSlot = jest.fn();
  const mockOnTimePickerOpen = jest.fn();

  const singleSlot: TimeSlot[] = [
    { start: '09:00', end: '17:00' },
  ];

  const multipleSlots: TimeSlot[] = [
    { start: '09:00', end: '12:00' },
    { start: '14:00', end: '17:00' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Slots Rendering', () => {
    it('should render single time slot', () => {
      const { getByText } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      expect(getByText('Время когда занят')).toBeTruthy();
      expect(getByText('09:00')).toBeTruthy();
      expect(getByText('17:00')).toBeTruthy();
      expect(getByText('С')).toBeTruthy();
      expect(getByText('До')).toBeTruthy();
    });

    it('should render multiple time slots', () => {
      const { getAllByText } = render(
        <TimeSlotsEditor
          slots={multipleSlots}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      expect(getAllByText('С').length).toBe(2); // Two "from" labels
      expect(getAllByText('До').length).toBe(2); // Two "to" labels
      expect(getAllByText('09:00').length).toBe(1);
      expect(getAllByText('12:00').length).toBe(1);
      expect(getAllByText('14:00').length).toBe(1);
      expect(getAllByText('17:00').length).toBe(1);
    });
  });

  describe('Add Slot Button', () => {
    it('should render add slot button', () => {
      const { getByText } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      expect(getByText('Добавить слот')).toBeTruthy();
    });

    it('should call onAddSlot when button pressed', () => {
      const { getByText } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      const addButton = getByText('Добавить слот');
      fireEvent.press(addButton);

      expect(mockOnAddSlot).toHaveBeenCalledTimes(1);
    });
  });

  describe('Remove Slot Button', () => {
    it('should not show remove button when only 1 slot', () => {
      const { UNSAFE_queryAllByType } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Find all Ionicons, trash-outline should not exist
      const icons = UNSAFE_queryAllByType(require('@expo/vector-icons').Ionicons);
      const trashIcons = icons.filter(i => i.props.name === 'trash-outline');
      expect(trashIcons.length).toBe(0);
    });

    it('should show remove button when >1 slots', () => {
      const { UNSAFE_getAllByType } = render(
        <TimeSlotsEditor
          slots={multipleSlots}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Find all trash icons (should be 2, one for each slot)
      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const trashIcons = icons.filter(i => i.props.name === 'trash-outline');
      expect(trashIcons.length).toBe(2);
    });

    it('should call onRemoveSlot with correct index', () => {
      const { UNSAFE_getAllByType } = render(
        <TimeSlotsEditor
          slots={multipleSlots}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Find all TouchableOpacity components
      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

      // Find the first remove button (trash icon)
      const removeButtons = touchables.filter(t => {
        const icon = t.props.children?.props?.name;
        return icon === 'trash-outline';
      });

      // Click first remove button (should remove index 0)
      fireEvent.press(removeButtons[0]);
      expect(mockOnRemoveSlot).toHaveBeenCalledWith(0);

      // Click second remove button (should remove index 1)
      fireEvent.press(removeButtons[1]);
      expect(mockOnRemoveSlot).toHaveBeenCalledWith(1);
    });
  });

  describe('Time Picker Opening', () => {
    it('should call onTimePickerOpen for start time', () => {
      const { getAllByText } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Find start time button (09:00)
      const startTimeButton = getAllByText('09:00')[0].parent;
      if (startTimeButton) {
        fireEvent.press(startTimeButton);
        expect(mockOnTimePickerOpen).toHaveBeenCalledWith(0, 'start');
      }
    });

    it('should call onTimePickerOpen for end time', () => {
      const { getAllByText } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Find end time button (17:00)
      const endTimeButton = getAllByText('17:00')[0].parent;
      if (endTimeButton) {
        fireEvent.press(endTimeButton);
        expect(mockOnTimePickerOpen).toHaveBeenCalledWith(0, 'end');
      }
    });

    it('should call onTimePickerOpen with correct slot index', () => {
      const { getAllByText } = render(
        <TimeSlotsEditor
          slots={multipleSlots}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Click second slot's start time (14:00)
      const secondSlotStartButton = getAllByText('14:00')[0].parent;
      if (secondSlotStartButton) {
        fireEvent.press(secondSlotStartButton);
        expect(mockOnTimePickerOpen).toHaveBeenCalledWith(1, 'start');
      }
    });
  });

  describe('Validation Error Display', () => {
    it('should not show error when validationError is null', () => {
      const { queryByText } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Should not find any validation error
      const { UNSAFE_queryAllByType } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );
      const icons = UNSAFE_queryAllByType(require('@expo/vector-icons').Ionicons);
      const warningIcon = icons.find(i => i.props.name === 'warning');
      expect(warningIcon).toBeUndefined();
    });

    it('should show error message when validationError is provided', () => {
      const errorMessage = 'End time must be after start time';

      const { getByText, UNSAFE_getAllByType } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={errorMessage}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      expect(getByText(errorMessage)).toBeTruthy();

      // Should show warning icon
      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const warningIcon = icons.find(i => i.props.name === 'warning');
      expect(warningIcon).toBeTruthy();
    });

    it('should show different error messages', () => {
      const error1 = 'Time slots cannot overlap';
      const error2 = 'Invalid time format';

      const { getByText, rerender } = render(
        <TimeSlotsEditor
          slots={multipleSlots}
          validationError={error1}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      expect(getByText(error1)).toBeTruthy();

      // Change error message
      rerender(
        <TimeSlotsEditor
          slots={multipleSlots}
          validationError={error2}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      expect(getByText(error2)).toBeTruthy();
    });
  });

  describe('Time Value Display', () => {
    it('should display correct time values for each slot', () => {
      const { getByText } = render(
        <TimeSlotsEditor
          slots={multipleSlots}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // First slot
      expect(getByText('09:00')).toBeTruthy();
      expect(getByText('12:00')).toBeTruthy();

      // Second slot
      expect(getByText('14:00')).toBeTruthy();
      expect(getByText('17:00')).toBeTruthy();
    });

    it('should show time icons next to time values', () => {
      const { UNSAFE_getAllByType } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const timeIcons = icons.filter(i => i.props.name === 'time-outline');

      // Should have 2 time icons (one for start, one for end)
      expect(timeIcons.length).toBe(2);
    });

    it('should show arrow between start and end times', () => {
      const { UNSAFE_getAllByType } = render(
        <TimeSlotsEditor
          slots={singleSlot}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const arrowIcon = icons.find(i => i.props.name === 'arrow-forward');

      expect(arrowIcon).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty slots array', () => {
      const { getByText } = render(
        <TimeSlotsEditor
          slots={[]}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Should still render title and add button
      expect(getByText('Время когда занят')).toBeTruthy();
      expect(getByText('Добавить слот')).toBeTruthy();
    });

    it('should handle many slots (>2)', () => {
      const manySlots: TimeSlot[] = [
        { start: '09:00', end: '10:00' },
        { start: '11:00', end: '12:00' },
        { start: '13:00', end: '14:00' },
        { start: '15:00', end: '16:00' },
      ];

      const { getAllByText, UNSAFE_getAllByType } = render(
        <TimeSlotsEditor
          slots={manySlots}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Should have 4 "from" and 4 "to" labels
      expect(getAllByText('С').length).toBe(4);
      expect(getAllByText('До').length).toBe(4);

      // Should have 4 remove buttons
      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const trashIcons = icons.filter(i => i.props.name === 'trash-outline');
      expect(trashIcons.length).toBe(4);
    });

    it('should handle time values with seconds', () => {
      const slotWithSeconds: TimeSlot[] = [
        { start: '09:00:00', end: '17:00:00' },
      ];

      const { getByText } = render(
        <TimeSlotsEditor
          slots={slotWithSeconds}
          validationError={null}
          onSlotChange={mockOnSlotChange}
          onAddSlot={mockOnAddSlot}
          onRemoveSlot={mockOnRemoveSlot}
          onTimePickerOpen={mockOnTimePickerOpen}
        />
      );

      // Should display full time string including seconds
      expect(getByText('09:00:00')).toBeTruthy();
      expect(getByText('17:00:00')).toBeTruthy();
    });
  });
});
