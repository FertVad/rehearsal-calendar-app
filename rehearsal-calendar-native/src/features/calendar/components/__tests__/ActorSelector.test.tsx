/**
 * Unit Tests for ActorSelector Component
 *
 * Tests:
 * - Loading state
 * - Empty state
 * - Member list rendering
 * - Individual member selection/deselection
 * - Select All / Deselect All
 * - Expand/Collapse functionality
 * - Availability status display (available, busy, partial)
 * - Admin badge display
 * - Selection summary
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ActorSelector } from '../ActorSelector';
import { ProjectMember } from '../../../../shared/types';

// Mock dependencies
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: {
      rehearsals: {
        loadingMembers: 'Loading members...',
        noMembers: 'No members',
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        expand: 'Expand',
        collapse: 'Collapse',
        selectedCount: (count: number, total: number) => `${count} of ${total} selected`,
        admin: 'Admin',
        availableStatus: 'Available',
        busyAllDay: 'Busy all day',
        busyTime: 'Busy',
      },
    },
  }),
}));

describe('ActorSelector Component', () => {
  const mockMembers: ProjectMember[] = [
    {
      id: '1',
      userId: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'admin',
      status: 'active',
    },
    {
      id: '2',
      userId: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      role: 'member',
      status: 'active',
    },
    {
      id: '3',
      userId: '3',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob@example.com',
      role: 'member',
      status: 'active',
    },
  ];

  const mockOnSelectionChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading message when loading is true', () => {
      const { getByText } = render(
        <ActorSelector
          members={[]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
          loading={true}
        />
      );

      expect(getByText('Loading members...')).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should display empty message when no members', () => {
      const { getByText, UNSAFE_getByType } = render(
        <ActorSelector
          members={[]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(getByText('No members')).toBeTruthy();
      // Should show people icon
      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon.props.name).toBe('people-outline');
    });
  });

  describe('Member List Rendering', () => {
    it('should render all members when expanded', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Click expand button
      const expandButton = getByText('Expand');
      fireEvent.press(expandButton);

      // Should show all member names
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('Jane Smith')).toBeTruthy();
      expect(getByText('Bob Johnson')).toBeTruthy();
    });

    it('should not render members when collapsed', () => {
      const { getByText, queryByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Initially collapsed
      expect(queryByText('John Doe')).toBeNull();
      expect(queryByText('Jane Smith')).toBeNull();
    });

    it('should render member name without last name', () => {
      const memberNoLastName: ProjectMember = {
        id: '4',
        userId: '4',
        firstName: 'Alice',
        lastName: '',
        email: 'alice@example.com',
        role: 'member',
        status: 'active',
      };

      const { getByText } = render(
        <ActorSelector
          members={[memberNoLastName]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      expect(getByText('Alice')).toBeTruthy();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should toggle expand/collapse on button press', () => {
      const { getByText, queryByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Initially collapsed
      expect(queryByText('John Doe')).toBeNull();
      expect(getByText('Expand')).toBeTruthy();

      // Click expand
      fireEvent.press(getByText('Expand'));

      // Should be expanded
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('Collapse')).toBeTruthy();

      // Click collapse
      fireEvent.press(getByText('Collapse'));

      // Should be collapsed again
      expect(queryByText('John Doe')).toBeNull();
    });
  });

  describe('Individual Member Selection', () => {
    it('should select member when clicked', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      // Click on first member
      const member = getByText('John Doe');
      fireEvent.press(member.parent?.parent || member);

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['1']);
    });

    it('should deselect member when clicked again', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={['1']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      // Click on selected member
      const member = getByText('John Doe');
      fireEvent.press(member.parent?.parent || member);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
    });

    it('should add to existing selection', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={['1']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      // Click on second member
      const member = getByText('Jane Smith');
      fireEvent.press(member.parent?.parent || member);

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['1', '2']);
    });
  });

  describe('Select All / Deselect All', () => {
    it('should select all members when "Select All" pressed', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const selectAllButton = getByText('Select All');
      fireEvent.press(selectAllButton);

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('should deselect all members when "Deselect All" pressed', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={['1', '2', '3']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      const deselectAllButton = getByText('Deselect All');
      fireEvent.press(deselectAllButton);

      expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
    });

    it('should not show Select All button when only 1 member', () => {
      const { queryByText, getByText } = render(
        <ActorSelector
          members={[mockMembers[0]]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(queryByText('Select All')).toBeNull();
      expect(getByText('Expand')).toBeTruthy();
    });
  });

  describe('Selection Summary', () => {
    it('should display selection count when members selected', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={['1', '2']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(getByText('2 of 3 selected')).toBeTruthy();
    });

    it('should not display summary when no members selected', () => {
      const { queryByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      expect(queryByText(/selected/)).toBeNull();
    });
  });

  describe('Admin Badge', () => {
    it('should show admin badge for admin members', () => {
      const { getByText, getAllByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      // First member is admin
      expect(getAllByText('Admin').length).toBeGreaterThan(0);
    });

    it('should show admin badge for owner role', () => {
      const ownerMember: ProjectMember = {
        id: '5',
        userId: '5',
        firstName: 'Owner',
        lastName: 'User',
        email: 'owner@example.com',
        role: 'owner',
        status: 'active',
      };

      const { getByText } = render(
        <ActorSelector
          members={[ownerMember]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      expect(getByText('Admin')).toBeTruthy();
    });

    it('should not show admin badge for regular members', () => {
      const { getByText, queryByText } = render(
        <ActorSelector
          members={[mockMembers[1]]} // Jane Smith - member role
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      // Should render member name but no admin badge
      expect(getByText('Jane Smith')).toBeTruthy();
      expect(queryByText('Admin')).toBeNull();
    });
  });

  describe('Availability Status', () => {
    const memberAvailability = {
      '1': { timeRanges: [] }, // Available (no busy times)
      '2': { timeRanges: [{ start: '00:00', end: '23:59' }] }, // Busy all day
      '3': { timeRanges: [{ start: '10:00', end: '12:00' }] }, // Partial
    };

    it('should show "Available" when no busy times', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
          date="2025-12-29"
          memberAvailability={memberAvailability}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      expect(getByText('Available')).toBeTruthy();
    });

    it('should show "Busy all day" for full day busy', () => {
      const { getByText } = render(
        <ActorSelector
          members={[mockMembers[1]]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
          date="2025-12-29"
          memberAvailability={memberAvailability}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      expect(getByText('Busy all day')).toBeTruthy();
    });

    it('should show partial busy times', () => {
      const { getByText } = render(
        <ActorSelector
          members={[mockMembers[2]]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
          date="2025-12-29"
          memberAvailability={memberAvailability}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      expect(getByText('Busy 10:00-12:00')).toBeTruthy();
    });

    it('should show multiple partial busy times', () => {
      const multipleRanges = {
        '1': {
          timeRanges: [
            { start: '10:00', end: '12:00' },
            { start: '14:00', end: '16:00' },
          ],
        },
      };

      const { getByText } = render(
        <ActorSelector
          members={[mockMembers[0]]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
          date="2025-12-29"
          memberAvailability={multipleRanges}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      expect(getByText('Busy 10:00-12:00')).toBeTruthy();
      expect(getByText('Busy 14:00-16:00')).toBeTruthy();
    });

    it('should not show availability when date is not provided', () => {
      const { getByText, queryByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
          memberAvailability={memberAvailability}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      // Should not show any availability status
      expect(queryByText('Available')).toBeNull();
      expect(queryByText('Busy all day')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty memberAvailability object', () => {
      const { getByText, getAllByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
          date="2025-12-29"
          memberAvailability={{}}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      // Should show "Available" for all members (default when no data)
      const availableTexts = getAllByText('Available');
      expect(availableTexts.length).toBeGreaterThan(0);
    });

    it('should handle selecting all then deselecting one', () => {
      const { getByText } = render(
        <ActorSelector
          members={mockMembers}
          selectedMemberIds={['1', '2', '3']}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      // Click on first member to deselect
      const member = getByText('John Doe');
      fireEvent.press(member.parent?.parent || member);

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['2', '3']);
    });

    it('should handle member with only firstName', () => {
      const memberOnlyFirst: ProjectMember = {
        id: '6',
        userId: '6',
        firstName: 'SingleName',
        lastName: undefined,
        email: 'single@example.com',
        role: 'member',
        status: 'active',
      };

      const { getByText } = render(
        <ActorSelector
          members={[memberOnlyFirst]}
          selectedMemberIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />
      );

      // Expand
      fireEvent.press(getByText('Expand'));

      expect(getByText('SingleName')).toBeTruthy();
    });
  });
});
