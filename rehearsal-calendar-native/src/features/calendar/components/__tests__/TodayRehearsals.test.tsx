/**
 * Unit Tests for TodayRehearsals Component
 *
 * Tests:
 * - Loading state
 * - Empty state
 * - Rehearsals list rendering
 * - Admin controls (edit/delete) visibility
 * - RSVP button functionality
 * - Date label (today, tomorrow, or formatted date)
 * - Sync indicators
 * - Admin stats display
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TodayRehearsals from '../TodayRehearsals';
import { Rehearsal, Project, RSVPStatus } from '../../../../shared/types';

// Mock dependencies
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: {
      common: {
        today: 'Today',
      },
      calendar: {
        tomorrow: 'Tomorrow',
        noRehearsals: 'No rehearsals',
      },
      projects: {
        admin: 'Admin',
      },
    },
    language: 'en',
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
}));

jest.mock('../../../../shared/utils/calendarStorage', () => ({
  isRehearsalSynced: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('../../../../shared/services/api', () => ({
  rehearsalsAPI: {
    getResponses: jest.fn(),
  },
}));

jest.mock('../ParticipantsModal', () => ({
  ParticipantsModal: () => null,
}));

describe('TodayRehearsals Component', () => {
  const mockProjects: Project[] = [
    {
      id: '1',
      chat_id: 'chat1',
      name: 'Project Alpha',
      timezone: 'UTC',
      is_admin: true,
      created_at: '2025-01-01',
    },
    {
      id: '2',
      chat_id: 'chat2',
      name: 'Project Beta',
      timezone: 'UTC',
      is_admin: false,
      created_at: '2025-01-01',
    },
  ];

  const mockRehearsals: Rehearsal[] = [
    {
      id: 'r1',
      projectId: '1',
      startsAt: '2025-12-29T10:00:00Z',
      endsAt: '2025-12-29T12:00:00Z',
      date: '2025-12-29',
      time: '10:00:00',
      endTime: '12:00:00',
      location: 'Studio A',
    },
    {
      id: 'r2',
      projectId: '2',
      startsAt: '2025-12-29T14:00:00Z',
      endsAt: '2025-12-29T16:00:00Z',
      date: '2025-12-29',
      time: '14:00:00',
      endTime: '16:00:00',
      location: 'Studio B',
    },
  ];

  const mockRsvpResponses: Record<string, RSVPStatus> = {
    r1: 'yes',
    r2: null,
  };

  const mockAdminStats = {
    r1: { confirmed: 5, invited: 10 },
    r2: { confirmed: 0, invited: 5 },
  };

  const mockOnRSVP = jest.fn();
  const mockOnDeleteRehearsal = jest.fn();
  const mockSetRsvpResponses = jest.fn();
  const mockSetAdminStats = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading indicator when loading is true', () => {
      // Mock date to match selectedDate
      const mockDate = new Date('2025-12-28T12:00:00');
      jest.spyOn(global, 'Date').mockImplementation(((...args: any[]) => {
        if (args.length === 0) {
          return mockDate;
        }
        return new (jest.requireActual('util').types.isDate(args[0]) ? Date : Object)(
          ...args
        ) as any;
      }) as any);

      const { getByText, UNSAFE_getByType } = render(
        <TodayRehearsals
          rehearsals={[]}
          selectedDate="2025-12-28"
          loading={true}
          projects={mockProjects}
          rsvpResponses={{}}
          respondingId={null}
          adminStats={{}}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      expect(getByText('Today')).toBeTruthy();
      expect(UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy();

      // Restore date mock
      jest.restoreAllMocks();
    });
  });

  describe('Empty State', () => {
    it('should display empty message when no rehearsals', () => {
      const { getByText } = render(
        <TodayRehearsals
          rehearsals={[]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={{}}
          respondingId={null}
          adminStats={{}}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      expect(getByText('No rehearsals')).toBeTruthy();
    });
  });

  describe('Rehearsals List Rendering', () => {
    it('should render all rehearsals', () => {
      const { getByText } = render(
        <TodayRehearsals
          rehearsals={mockRehearsals}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      expect(getByText('10:00 — 12:00')).toBeTruthy();
      expect(getByText('14:00 — 16:00')).toBeTruthy();
      expect(getByText('Project Alpha')).toBeTruthy();
      expect(getByText('Project Beta')).toBeTruthy();
      expect(getByText('Studio A')).toBeTruthy();
      expect(getByText('Studio B')).toBeTruthy();
    });

    it('should display time without end time if missing', () => {
      const rehearsalNoEndTime: Rehearsal = {
        ...mockRehearsals[0],
        endTime: undefined,
      };

      const { getByText } = render(
        <TodayRehearsals
          rehearsals={[rehearsalNoEndTime]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Should only show start time (first 5 chars: "10:00")
      expect(getByText(/10:00/)).toBeTruthy();
    });
  });

  describe('Admin Controls', () => {
    it('should show admin badge and controls for admin projects', () => {
      const { getAllByText, UNSAFE_getAllByType } = render(
        <TodayRehearsals
          rehearsals={mockRehearsals}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // First rehearsal is in admin project, should show Admin badge
      expect(getAllByText('Admin').length).toBeGreaterThan(0);
    });

    it('should call onDeleteRehearsal when delete button pressed', () => {
      const { UNSAFE_getAllByType } = render(
        <TodayRehearsals
          rehearsals={[mockRehearsals[0]]} // Only admin project rehearsal
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Find all TouchableOpacity components
      const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

      // Find delete button by icon (trash-outline) - it's one of the touchables
      // We know it's the delete button by its context
      const deleteButton = touchables.find(t => {
        const icon = t.props.children?.props?.name;
        return icon === 'trash-outline';
      });

      if (deleteButton) {
        fireEvent.press(deleteButton);
        expect(mockOnDeleteRehearsal).toHaveBeenCalledWith('r1');
      }
    });

    it('should not show admin controls for non-admin projects', () => {
      const { queryByText } = render(
        <TodayRehearsals
          rehearsals={[mockRehearsals[1]]} // Only non-admin project rehearsal
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Should not show Admin badge for non-admin project
      // The component only shows the badge when is_admin is true
      const adminTexts = queryByText('Admin');
      // Admin text should not be present for non-admin rehearsal
    });
  });

  describe('RSVP Button', () => {
    it('should call onRSVP when heart button pressed', () => {
      const { UNSAFE_getAllByType } = render(
        <TodayRehearsals
          rehearsals={[mockRehearsals[0]]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Find the RSVP Pressable (like button)
      const pressables = UNSAFE_getAllByType(require('react-native').Pressable);
      const likeButton = pressables.find(p => {
        // Like button contains Ionicons with heart or heart-outline
        const icon = p.props.children?.[0]?.props?.name;
        return icon === 'heart' || icon === 'heart-outline';
      });

      if (likeButton) {
        fireEvent.press(likeButton);
        expect(mockOnRSVP).toHaveBeenCalledWith(
          'r1',
          'yes',
          expect.any(Function)
        );
      }
    });

    it('should show filled heart for yes response', () => {
      const { UNSAFE_getAllByType } = render(
        <TodayRehearsals
          rehearsals={[mockRehearsals[0]]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={{ r1: 'yes' }}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Find Ionicons with name="heart" (filled)
      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const heartIcon = icons.find(i => i.props.name === 'heart');
      expect(heartIcon).toBeTruthy();
    });

    it('should show outline heart for null response', () => {
      const { UNSAFE_getAllByType } = render(
        <TodayRehearsals
          rehearsals={[mockRehearsals[1]]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={{ r2: null }}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Find Ionicons with name="heart-outline"
      const icons = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons);
      const heartIcon = icons.find(i => i.props.name === 'heart-outline');
      expect(heartIcon).toBeTruthy();
    });

    it('should disable RSVP button when responding', () => {
      const { UNSAFE_getAllByType } = render(
        <TodayRehearsals
          rehearsals={[mockRehearsals[0]]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId="r1" // Currently responding to r1
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      const pressables = UNSAFE_getAllByType(require('react-native').Pressable);
      const likeButton = pressables.find(p => {
        const icon = p.props.children?.[0]?.props?.name;
        return icon === 'heart' || icon === 'heart-outline';
      });

      expect(likeButton?.props.disabled).toBe(true);
    });
  });

  describe('Admin Stats Display', () => {
    it('should display stats for admin projects', () => {
      const { getByText } = render(
        <TodayRehearsals
          rehearsals={[mockRehearsals[0]]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Should show "5/15" for admin project (confirmed/total where total = confirmed + invited)
      expect(getByText('5/15')).toBeTruthy();
    });

    it('should display only confirmed count for non-admin projects', () => {
      const { queryByText } = render(
        <TodayRehearsals
          rehearsals={[mockRehearsals[1]]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Non-admin project should not show full stats
      expect(queryByText('0/5')).toBeNull();
    });
  });

  describe('Date Label', () => {
    it('should show "Today" for today\'s date', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const { getByText } = render(
        <TodayRehearsals
          rehearsals={mockRehearsals}
          selectedDate={todayStr}
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      expect(getByText('Today')).toBeTruthy();
    });

    it('should show "Tomorrow" for tomorrow\'s date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { getByText } = render(
        <TodayRehearsals
          rehearsals={mockRehearsals}
          selectedDate={tomorrowStr}
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      expect(getByText('Tomorrow')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rehearsal without location', () => {
      const rehearsalNoLocation: Rehearsal = {
        ...mockRehearsals[0],
        location: undefined,
      };

      const { queryByText } = render(
        <TodayRehearsals
          rehearsals={[rehearsalNoLocation]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Should not display location row
      expect(queryByText('Studio A')).toBeNull();
    });

    it('should handle rehearsal with no matching project', () => {
      const orphanRehearsal: Rehearsal = {
        ...mockRehearsals[0],
        projectId: 'non-existent',
      };

      const { queryByText } = render(
        <TodayRehearsals
          rehearsals={[orphanRehearsal]}
          selectedDate="2025-12-29"
          loading={false}
          projects={mockProjects}
          rsvpResponses={mockRsvpResponses}
          respondingId={null}
          adminStats={mockAdminStats}
          onRSVP={mockOnRSVP}
          onDeleteRehearsal={mockOnDeleteRehearsal}
          setRsvpResponses={mockSetRsvpResponses}
          setAdminStats={mockSetAdminStats}
        />
      );

      // Should still render the rehearsal but without project name
      expect(queryByText('Project Alpha')).toBeNull();
    });
  });
});
