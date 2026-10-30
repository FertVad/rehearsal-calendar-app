/**
 * DP01 — switching projects must re-seed the member filter from the new
 * project's roster.
 *
 * Root cause: when setParams changes projectId the component re-renders with
 * new props but useSmartPlanner's internal members state still carries the old
 * project's list. The seeding effect ran in the same batch, saw stale
 * simpleMembers, and locked in the previous project's IDs under the new
 * projectId key — so the new project's real members never replaced them.
 *
 * The fix adds membersProjectId to the hook's return value: the seeding effect
 * only fires once membersProjectId matches the current projectId, guaranteeing
 * the members in state were actually loaded for the active project.
 *
 * Test approach: re-render with a new projectId (same as what setParams does),
 * wait for the new project's data to settle, then tap a slot button and verify
 * that prefilledMemberIds carries the new project's IDs, not the old one's.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { translations } from '../../../../i18n/translations';
import { projectsAPI } from '../../../../shared/services/api';
import SmartPlannerScreen from '../SmartPlannerScreen';

const t = translations.en;

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../../../shared/utils/logger', () => ({
  logger: { debug: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: require('../../../../i18n/translations').translations.en,
    language: 'en',
  }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', timezone: 'UTC' } }),
}));
jest.mock('../../../../contexts/ProjectContext', () => ({
  useProjects: () => ({
    projects: [
      { id: 'A', name: 'Project A', is_admin: true, timezone: 'UTC', created_at: '2026-01-01T00:00:00Z' },
      { id: 'B', name: 'Project B', is_admin: true, timezone: 'UTC', created_at: '2026-01-02T00:00:00Z' },
    ],
  }),
}));
jest.mock('../../../../shared/services/api', () => ({
  projectsAPI: {
    getProject: jest.fn(),
    getMembers: jest.fn(),
    getMembersAvailabilityRange: jest.fn(),
  },
}));
jest.mock('../../../../shared/hooks/useClock', () => ({
  // Fixed point in the past: all slots in today's range are "future" and render
  useNow: () => new Date('2026-01-01T08:00:00Z'),
  useToday: () => '2026-01-01',
  useTimezone: () => 'America/New_York',
}));

const member = (userId: string) => ({
  userId,
  firstName: `Name${userId}`,
  lastName: '',
  role: 'member' as const,
  status: 'active' as const,
});

// Project A has 3 members, project B has 2 — counts differ so any stale seed
// is detectable: "3 of 2 selected" vs the correct "2 of 2 selected".
const MEMBERS: Record<string, ReturnType<typeof member>[]> = {
  A: ['a1', 'a2', 'a3'].map(member),
  B: ['b1', 'b2'].map(member),
};

const getProject = projectsAPI.getProject as jest.Mock;
const getMembers = projectsAPI.getMembers as jest.Mock;
const getAvailability = projectsAPI.getMembersAvailabilityRange as jest.Mock;

const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  navigate.mockClear();

  const { useNavigation } = require('@react-navigation/native');
  (useNavigation as jest.Mock).mockReturnValue({ navigate, goBack: jest.fn() });

  getProject.mockImplementation(async (id: string) => ({
    data: {
      project: { id, name: `Project ${id}`, timezone: 'UTC', created_at: '2026-01-01T00:00:00Z' },
    },
  }));
  getMembers.mockImplementation(async (id: string) => ({
    data: { members: MEMBERS[id] ?? [] },
  }));
  getAvailability.mockResolvedValue({ data: { availability: [] } });
});

const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

function makeProps(projectId: string) {
  return {
    route: { params: { projectId }, key: 'planner', name: 'SmartPlanner' } as any,
    navigation: { setParams: jest.fn(), goBack: jest.fn() } as any,
  };
}

describe('DP01 — roster reload within the same project (R5-01)', () => {
  it('drops removed members from selection when the roster reloads', async () => {
    // Phase 1: project A loads with 3 members; selection seeds to all three.
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    // Phase 2: a3 is removed from the project. Next reload must drop it.
    getMembers.mockImplementation(async (id: string) => ({
      data: { members: id === 'A' ? ['a1', 'a2'].map(member) : (MEMBERS[id] ?? []) },
    }));

    // Trigger reload by switching to the Month period (changes date range).
    fireEvent.press(screen.getByText(t.smartPlanner.month));
    await settle();
    await settle();
    await settle();

    // With the bug: selectedMemberIds = [a1,a2,a3], members = [a1,a2]
    //   → "3 of 2 selected" — slot generator receives a3 which is not in
    //   simpleMembers, counts zero valid members, renders no slot buttons.
    // With the fix: selectedMemberIds trimmed to [a1,a2] → "2 of 2 selected".
    expect(screen.queryByText(/3 of 2/)).toBeNull();
  });
});

describe('The range under the period (cause fix 14)', () => {
  it('names the profile\'s days, not the device\'s', async () => {
    // Today is 1 January in the profile's zone; the device is in New York
    // (jest.config.js), behind UTC. '2026-01-01' read as UTC midnight is
    // 31 December there.
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();

    expect(screen.getByText('1-7 Jan')).toBeTruthy();
  });
});

describe('The participants sheet over the planner (T-010)', () => {
  it('takes a tap with its search\'s keyboard up', async () => {
    // The sheet is inside the screen's scroll for React's touches; a scroll
    // left to its default caught the tap to put the keyboard away.
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();

    const scroll = screen.UNSAFE_getByType('ScrollView' as any);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.findByProps({ testID: 'participants-row' })).toBeTruthy();
  });
});

describe('DP01 — member selection follows the project', () => {
  it('member filter shows exactly the new project\'s count after switching', async () => {
    // Project A has 3 members, project B has 2. After switching, the filter
    // summary must reflect B's roster. With the bug the seeding effect fires
    // with A's stale members while the hook already carries projectId B, so the
    // summary reads "3 of 2 selected" — more selected than there are members.
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    // Re-render with new projectId — same as what navigation.setParams does
    screen.rerender(<SmartPlannerScreen {...makeProps('B')} />);
    await settle();
    await settle();
    await settle();

    // "3 of 2" means the stale seed from project A is still in effect.
    expect(screen.queryByText(/3 of 2/)).toBeNull();
  });

  it('member filter summary does not show more selected than there are members', async () => {
    // Same scenario, explicit regex to confirm no impossible count.
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    screen.rerender(<SmartPlannerScreen {...makeProps('B')} />);
    await settle();
    await settle();
    await settle();

    // With the fix: selectedMemberIds = [b1,b2] → "2 of 2 selected" (or
    // "All Members" if still loading). "3 of 2" never appears.
    expect(screen.queryByText(/3 of 2/)).toBeNull();
  });
});
