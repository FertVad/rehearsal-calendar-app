/**
 * Unit Tests for ModeSelector Component
 *
 * Tests:
 * - Rendering all three mode buttons
 * - Active mode styling
 * - Mode change callback
 * - Disabled state
 * - Icons for each mode
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ModeSelector from '../ModeSelector';
import { DayMode } from '../../../types/availability';

describe('ModeSelector Component', () => {
  const mockOnModeChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all three mode buttons', () => {
      const { getByText } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      expect(getByText('Свободен')).toBeTruthy();
      expect(getByText('Частично')).toBeTruthy();
      expect(getByText('Занят')).toBeTruthy();
    });

    it('should render with correct icons', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);

      // Should have 3 icons (one for each mode)
      expect(icons.length).toBe(3);

      // Check icon names
      const iconNames = icons.map(i => i.props.name);
      expect(iconNames).toContain('checkmark-circle'); // Free
      expect(iconNames).toContain('time'); // Custom
      expect(iconNames).toContain('close-circle'); // Busy
    });
  });

  describe('Active Mode Styling', () => {
    it('should highlight free mode when active', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

      // First touchable is "free" button
      const freeButton = touchables[0];
      const freeIcon = freeButton.props.children[0];

      // Free mode should have green color when active
      expect(freeIcon.props.color).toBe('#10b981'); // Colors.accent.green
    });

    it('should highlight custom mode when active', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="custom"
          onModeChange={mockOnModeChange}
        />
      );

      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

      // Second touchable is "custom" button
      const customButton = touchables[1];
      const customIcon = customButton.props.children[0];

      // Custom mode should have yellow color when active
      expect(customIcon.props.color).toBe('#f59e0b'); // Colors.accent.yellow
    });

    it('should highlight busy mode when active', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="busy"
          onModeChange={mockOnModeChange}
        />
      );

      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

      // Third touchable is "busy" button
      const busyButton = touchables[2];
      const busyIcon = busyButton.props.children[0];

      // Busy mode should have red color when active
      expect(busyIcon.props.color).toBe('#ef4444'); // Colors.accent.red
    });
  });

  describe('Mode Change', () => {
    it('should call onModeChange when free button pressed', () => {
      const { getByText } = render(
        <ModeSelector
          mode="busy"
          onModeChange={mockOnModeChange}
        />
      );

      const freeButton = getByText('Свободен');
      fireEvent.press(freeButton.parent || freeButton);

      expect(mockOnModeChange).toHaveBeenCalledWith('free');
    });

    it('should call onModeChange when custom button pressed', () => {
      const { getByText } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const customButton = getByText('Частично');
      fireEvent.press(customButton.parent || customButton);

      expect(mockOnModeChange).toHaveBeenCalledWith('custom');
    });

    it('should call onModeChange when busy button pressed', () => {
      const { getByText } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const busyButton = getByText('Занят');
      fireEvent.press(busyButton.parent || busyButton);

      expect(mockOnModeChange).toHaveBeenCalledWith('busy');
    });

    it('should allow clicking the same mode multiple times', () => {
      const { getByText } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const freeButton = getByText('Свободен');
      fireEvent.press(freeButton.parent || freeButton);
      fireEvent.press(freeButton.parent || freeButton);

      expect(mockOnModeChange).toHaveBeenCalledTimes(2);
      expect(mockOnModeChange).toHaveBeenNthCalledWith(1, 'free');
      expect(mockOnModeChange).toHaveBeenNthCalledWith(2, 'free');
    });
  });

  describe('Disabled State', () => {
    it('should disable all buttons when disabled prop is true', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
          disabled={true}
        />
      );

      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

      // All three buttons should be disabled
      touchables.forEach(button => {
        expect(button.props.disabled).toBe(true);
      });
    });

    it('should not call onModeChange when disabled', () => {
      const { getByText } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
          disabled={true}
        />
      );

      const busyButton = getByText('Занят');
      fireEvent.press(busyButton.parent || busyButton);

      // Should not call callback when disabled
      expect(mockOnModeChange).not.toHaveBeenCalled();
    });

    it('should enable all buttons when disabled prop is false', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
          disabled={false}
        />
      );

      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

      // All three buttons should be enabled
      touchables.forEach(button => {
        expect(button.props.disabled).toBe(false);
      });
    });
  });

  describe('Icon Colors', () => {
    it('should show green icon when free is active', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const checkmarkIcon = icons.find(i => i.props.name === 'checkmark-circle');

      expect(checkmarkIcon?.props.color).toBe('#10b981'); // Colors.accent.green
    });

    it('should show yellow icon when custom is active', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="custom"
          onModeChange={mockOnModeChange}
        />
      );

      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const timeIcon = icons.find(i => i.props.name === 'time');

      expect(timeIcon?.props.color).toBe('#f59e0b'); // Colors.accent.yellow
    });

    it('should show red icon when busy is active', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="busy"
          onModeChange={mockOnModeChange}
        />
      );

      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const closeIcon = icons.find(i => i.props.name === 'close-circle');

      expect(closeIcon?.props.color).toBe('#ef4444'); // Colors.accent.red
    });

    it('should show gray icons for inactive modes', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);

      // Custom and Busy should have tertiary (gray) color
      const timeIcon = icons.find(i => i.props.name === 'time');
      const closeIcon = icons.find(i => i.props.name === 'close-circle');

      expect(timeIcon?.props.color).toBe('#6e7681'); // Colors.text.tertiary
      expect(closeIcon?.props.color).toBe('#6e7681'); // Colors.text.tertiary
    });
  });

  describe('Mode Transitions', () => {
    it('should transition from free to custom', () => {
      const { getByText, rerender } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const customButton = getByText('Частично');
      fireEvent.press(customButton.parent || customButton);

      expect(mockOnModeChange).toHaveBeenCalledWith('custom');

      // Simulate mode change by re-rendering with new mode
      rerender(
        <ModeSelector
          mode="custom"
          onModeChange={mockOnModeChange}
        />
      );

      // Custom icon should now be highlighted
      const icons = require('@expo/vector-icons').Ionicons;
      expect(getByText('Частично')).toBeTruthy();
    });

    it('should transition from custom to busy', () => {
      const { getByText } = render(
        <ModeSelector
          mode="custom"
          onModeChange={mockOnModeChange}
        />
      );

      const busyButton = getByText('Занят');
      fireEvent.press(busyButton.parent || busyButton);

      expect(mockOnModeChange).toHaveBeenCalledWith('busy');
    });

    it('should transition from busy to free', () => {
      const { getByText } = render(
        <ModeSelector
          mode="busy"
          onModeChange={mockOnModeChange}
        />
      );

      const freeButton = getByText('Свободен');
      fireEvent.press(freeButton.parent || freeButton);

      expect(mockOnModeChange).toHaveBeenCalledWith('free');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid mode changes', () => {
      const { getByText } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const busyButton = getByText('Занят');
      const customButton = getByText('Частично');
      const freeButton = getByText('Свободен');

      // Rapidly press different buttons
      fireEvent.press(busyButton.parent || busyButton);
      fireEvent.press(customButton.parent || customButton);
      fireEvent.press(freeButton.parent || freeButton);
      fireEvent.press(busyButton.parent || busyButton);

      expect(mockOnModeChange).toHaveBeenCalledTimes(4);
      expect(mockOnModeChange).toHaveBeenNthCalledWith(1, 'busy');
      expect(mockOnModeChange).toHaveBeenNthCalledWith(2, 'custom');
      expect(mockOnModeChange).toHaveBeenNthCalledWith(3, 'free');
      expect(mockOnModeChange).toHaveBeenNthCalledWith(4, 'busy');
    });

    it('should handle undefined disabled prop (defaults to false)', () => {
      const { UNSAFE_getAllByType } = render(
        <ModeSelector
          mode="free"
          onModeChange={mockOnModeChange}
        />
      );

      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

      // Should be enabled by default
      touchables.forEach(button => {
        expect(button.props.disabled).toBe(false);
      });
    });
  });
});
