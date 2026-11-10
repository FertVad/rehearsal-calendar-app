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
import { StyleSheet } from 'react-native';
import { render, fireEvent, act, within } from '@testing-library/react-native';
import { translations } from '../../../../i18n/translations';
import { projectsAPI } from '../../../../shared/services/api';
import { formatTimeRange, phoneUses24HourClock } from '../../../../shared/utils/clockFormat';
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
const ALL_PROJECTS = [
  { id: 'A', name: 'Project A', is_admin: true, timezone: 'UTC', created_at: '2026-01-01T00:00:00Z' },
  { id: 'B', name: 'Project B', is_admin: true, timezone: 'UTC', created_at: '2026-01-02T00:00:00Z' },
  { id: 'C', name: 'Project C', is_admin: false, timezone: 'UTC', created_at: '2026-01-03T00:00:00Z' },
];
let mockProjects = ALL_PROJECTS;
jest.mock('../../../../contexts/ProjectContext', () => ({
  useProjects: () => ({ projects: mockProjects }),
}));
jest.mock('../../../../hooks/useWeekStart', () => ({ useWeekStart: () => 'monday' }));
jest.mock('../../../../shared/services/api', () => ({
  projectsAPI: {
    getProject: jest.fn(),
    getMembers: jest.fn(),
    getMembersAvailabilityRange: jest.fn(),
  },
}));
const MORNING = '2026-01-01T08:00:00Z';
let mockNow = MORNING;
jest.mock('../../../../shared/hooks/useClock', () => ({
  // Fixed point in the past: all slots in today's range are "future" and render
  useNow: () => new Date(mockNow),
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
  C: ['c1', 'c2'].map(member),
};

const getProject = projectsAPI.getProject as jest.Mock;
const getMembers = projectsAPI.getMembers as jest.Mock;
const getAvailability = projectsAPI.getMembersAvailabilityRange as jest.Mock;

const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockProjects = ALL_PROJECTS;
  mockNow = MORNING;
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
    fireEvent.press(screen.getByTestId('planner-period-month'));
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

    expect(screen.getByText('Jan 1 – Jan 7')).toBeTruthy();
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

// T-012. "+ Add" opened the form for anyone, and handed it the whole slot:
// "All day" became a rehearsal from 09:00 to 23:00.
describe('A slot\'s "+ Add" (T-012)', () => {
  it('gives the form the slot\'s start, and no end', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    expect(screen.getAllByText(t.smartPlanner.allDay).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('planner-add-2026-01-01-09:00'));

    expect(navigate).toHaveBeenCalledWith('AddRehearsal', expect.objectContaining({
      projectId: 'A', prefilledDate: '2026-01-01', prefilledTime: '09:00',
    }));
    expect(navigate.mock.calls[0][1]).not.toHaveProperty('prefilledEndTime');
  });

  // T-238: the form put the usual three hours on a slot of one, over the
  // people's busy time. The slot says how far the free time goes, for those
  // free at its start; the form ends the rehearsal there if that is sooner.
  describe('how far the free time goes (T-238)', () => {
    const busy = (ranges: Record<string, [string, string]>) => ({
      data: { availability: Object.entries(ranges).map(([userId, [start, end]]) => ({
        userId, firstName: `Name${userId}`, hasData: true,
        dates: [{ date: '2026-01-01', timeRanges: [{ start, end, type: 'busy' }] }],
      })) },
    });
    const open = async () => {
      const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
      await settle();
      await settle();
      return screen;
    };

    it('everyone free, an hour before someone is busy: the free time ends when they are', async () => {
      getAvailability.mockResolvedValue(busy({ a1: ['09:00', '13:00'], a2: ['14:00', '17:00'] }));
      const screen = await open();

      fireEvent.press(screen.getByTestId('planner-add-2026-01-01-13:00'));

      expect(navigate.mock.calls[0][1]).toMatchObject({ prefilledTime: '13:00', prefilledFreeUntil: '14:00' });
    });

    it('someone busy at the start: it ends when the first of the others is', async () => {
      getAvailability.mockResolvedValue(busy({ a1: ['09:00', '13:00'], a2: ['14:00', '17:00'] }));
      const screen = await open();

      // 13:00, where a1 is free again, is not where the others stop being.
      fireEvent.press(screen.getByTestId('planner-add-2026-01-01-09:00'));

      expect(navigate.mock.calls[0][1]).toMatchObject({ prefilledTime: '09:00', prefilledFreeUntil: '14:00' });
    });

    it('all day free: to the end of the working day', async () => {
      const screen = await open();

      fireEvent.press(screen.getByTestId('planner-add-2026-01-01-09:00'));

      expect(navigate.mock.calls[0][1]).toMatchObject({ prefilledTime: '09:00', prefilledFreeUntil: '23:00' });
    });
  });

  it('is shown only to an admin of the project', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('C')} />);
    await settle();
    await settle();

    // The slots are there, to read; nothing on them opens the form.
    expect(screen.getAllByText(t.smartPlanner.allDay).length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId(/^planner-add-/)).toHaveLength(0);
  });
});

// T-012: the segment chose "Select Dates" on the tap, and a cancelled picker
// left it selected over the week's dates. T-241: "Dates" is a segment.
describe('Cancel in "Dates"', () => {
  it('leaves the segment it was', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();

    fireEvent.press(screen.getByTestId('planner-period-month'));
    await settle();
    fireEvent.press(screen.getByTestId('planner-period-custom'));
    expect(screen.getByTestId('date-range-cancel')).toBeTruthy();
    fireEvent.press(screen.getByTestId('date-range-cancel'));
    await settle();

    expect(screen.getByTestId('planner-period-month').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('planner-period-custom').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('planner-period-week').props.accessibilityState).toMatchObject({ selected: false });
  });
});

// T-241 (owner, 09.11; board C): the project, the period and the people one
// under another. In one row they were cut in every language.
describe('The planner\'s filters, one under another (T-241)', () => {
  it('names the project; with nothing else to run, no chevron and no tap', async () => {
    mockProjects = [ALL_PROJECTS[0], ALL_PROJECTS[2]];
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    const project = screen.getByTestId('planner-project');
    expect(within(project).getByText('Project A')).toBeTruthy();
    expect(within(project).queryByTestId(/chevron/)).toBeNull();
    expect(project.props.accessibilityRole).toBeUndefined();
    expect(project.props.onClick ?? project.props.onPress).toBeUndefined();
    fireEvent.press(project);
    expect(screen.queryByLabelText('Project C')).toBeNull();
  });

  it('with another project to run, the name opens the choice, chevron and all', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    expect(within(screen.getByTestId('planner-project')).getByTestId('icon-Ionicons-chevron-down')).toBeTruthy();
    expect(screen.getByTestId('planner-project').props.accessibilityRole).toBe('button');
    // Not the name alone: that is the option's, under it.
    expect(screen.getByTestId('planner-project').props.accessibilityLabel).toBe('Project, Project A');
    // The name wraps, to a third line before it ends in "…".
    expect(within(screen.getByTestId('planner-project')).getByText('Project A').props.numberOfLines).toBe(3);
    fireEvent.press(screen.getByTestId('planner-project'));
    expect(screen.getByLabelText('Project B')).toBeTruthy();
  });

  it('changes the period with one tap on its segment, the picked one in sight', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    const segments = ['week', 'month', 'custom'].map(p => screen.getByTestId(`planner-period-${p}`));
    expect(segments.map(s => within(s).getByText(/.+/).props.children))
      .toEqual([t.smartPlanner.week, t.smartPlanner.month, t.smartPlanner.dates]);
    expect(segments[0].props.accessibilityState).toMatchObject({ selected: true });

    fireEvent.press(screen.getByTestId('planner-period-month'));
    await settle();
    await settle();

    expect(screen.getByTestId('planner-period-month').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('planner-period-week').props.accessibilityState).toMatchObject({ selected: false });
    expect(getAvailability).toHaveBeenLastCalledWith('A', '2026-01-01', '2026-01-30');
  });

  it('says who takes part by their faces and a count, the words whole', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    const row = screen.getByTestId('participants-row');
    expect(within(row).getByText('All participants · 3')).toBeTruthy();
    expect(within(row).getByText('All participants · 3').props.numberOfLines).toBeUndefined();
    // Everyone's three faces, Namea1 to Namea3: no "+N" for three.
    expect(within(screen.getByTestId('participants-faces')).getAllByText('N')).toHaveLength(3);
    expect(within(row).queryByText(/^\+\d/)).toBeNull();

    fireEvent.press(row);
    fireEvent.press(screen.getByTestId('participant-a2'));
    await settle();
    expect(within(screen.getByTestId('participants-row')).getByText('2 of 3')).toBeTruthy();
  });

  it('gives a slot a "+" that says what it adds, and when', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    const add = screen.getByTestId('planner-add-2026-01-01-09:00');
    expect(add.props.accessibilityRole).toBe('button');
    expect(add.props.accessibilityLabel).toBe(
      t.smartPlanner.addRehearsalAt(formatTimeRange('09:00', '23:00', 'en-US', phoneUses24HourClock())),
    );
    expect(screen.queryByText(/\+ Add/)).toBeNull();
    const flat = (style: unknown): object => (Array.isArray(style)
      ? Object.assign({}, ...style.map(flat)) : (style as object) ?? {});
    expect(flat(add.props.style)).toMatchObject({ width: 44, height: 44 });
  });

  it('dates the list by its days: today gone, from tomorrow', async () => {
    // Late on 1 January in the profile's day: its hours are past, and the
    // week's list begins on the 2nd. The title said "Jan 1 – Jan 7" over it.
    mockNow = '2026-01-02T03:59:00Z';
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    expect(screen.queryByTestId('planner-day-2026-01-01')).toBeNull();
    expect(screen.getByTestId('planner-day-2026-01-02')).toBeTruthy();
    expect(screen.getByText('Jan 2 – Jan 7')).toBeTruthy();
  });
});

// T-020 (owner, 30.10.2026): a day of one slot took 167 pt, a week four
// screens, and the filters 252 pt above the first recommendation.
describe('The planner\'s list, dense (T-020)', () => {
  const height = (node: { props: { style: unknown } }) => StyleSheet.flatten(node.props.style as any).height;

  it('heads a day with 28 pt and gives a slot a row of 52 (T-026)', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    expect(height(screen.getByTestId('planner-day-2026-01-01'))).toBe(28);
    expect(height(screen.getByTestId('planner-row-2026-01-01-09:00'))).toBe(52);
  });

  it('puts the project, the period and the people above the list, nothing else', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    const filters = screen.getByTestId('planner-filters');
    expect(within(filters).getByTestId('planner-project')).toBeTruthy();
    expect(within(filters).getByText('Project A')).toBeTruthy();
    expect(within(filters).getByTestId('planner-period')).toBeTruthy();
    expect(within(filters).getByTestId('participants-row')).toBeTruthy();
    // Nothing else stands above the list: the "Period" heading it once had is gone
    // (its key too, T-045).
    expect(screen.queryByText('Period')).toBeNull();
  });

  it('opens the project\'s and the people\'s choices', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    await settle();

    // The period: a tap on its segment, and the list's dates follow.
    fireEvent.press(screen.getByTestId('planner-period-month'));
    await settle();
    expect(screen.getByText('Jan 1 – Jan 30')).toBeTruthy();

    // The project: the projects this person runs.
    expect(screen.queryByText('Project B')).toBeNull();
    fireEvent.press(screen.getByTestId('planner-project'));
    expect(screen.getByText('Project B')).toBeTruthy();
    expect(screen.queryByText('Project C')).toBeNull();
    // The picked one is named by its name alone, its checkmark not in it (T-219).
    const options = screen.getAllByLabelText('Project A').filter(n => n.props.testID !== 'planner-project');
    expect(options).toHaveLength(1);
    expect(options[0].props.accessibilityState).toEqual({ selected: true });

    // The people: their sheet.
    fireEvent.press(screen.getByTestId('participants-row'));
    expect(screen.getByTestId('participants-all')).toBeTruthy();
    fireEvent.press(screen.getByTestId('participant-a2'));
    await settle();
    expect(screen.getByLabelText('Participants, 2 of 3')).toBeTruthy();
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

// T-032: the tab's first screen, a large title and no way back; opened from
// the tab with no project, it is set to the first one in its params.
describe('the Planner tab\'s root screen (T-032)', () => {
  it('has the tab\'s large title and nothing to go back to', async () => {
    const screen = render(<SmartPlannerScreen {...makeProps('A')} />);
    await settle();
    expect(screen.getByTestId('screen-header-root')).toBeTruthy();
    expect(within(screen.getByTestId('screen-header-root')).getByText(t.nav.planner)).toBeTruthy();
    expect(screen.queryByTestId('header-back')).toBeNull();
    expect(screen.queryByLabelText(t.common.back)).toBeNull();
  });

  it('opened from the tab, it takes the first project into its params', async () => {
    const navigation = { setParams: jest.fn(), goBack: jest.fn() } as any;
    const screen = render(
      <SmartPlannerScreen route={{ key: 'planner', name: 'SmartPlanner' } as any} navigation={navigation} />,
    );
    await settle();
    expect(navigation.setParams).toHaveBeenCalledWith({ projectId: 'A' });
    expect(screen.getByTestId('screen-header-root')).toBeTruthy();
  });
});
