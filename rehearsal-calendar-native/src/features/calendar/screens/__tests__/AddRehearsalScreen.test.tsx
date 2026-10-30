/**
 * The rehearsal form as a whole: who goes onto the rehearsal it saves
 * (DP02, review R9-01, R9-02).
 *
 * The defects lived between the pieces — the planner's people not reaching
 * the form, re-picking the project shown clearing them (and on an edit,
 * clearing the saved roster), a return to the planner's project depending on
 * whether a project visited in between had loaded, and Create sending nobody
 * while the members were still loading or had failed to load. So these tests
 * drive the real screen, form, seeding, members load and submit, with only the
 * API, navigation and contexts standing in.
 */
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { translations } from '../../../../i18n/translations';
import { projectsAPI, rehearsalsAPI } from '../../../../shared/services/api';
import AddRehearsalScreen from '../AddRehearsalScreen';

const t = translations.en;
let routeParams: Record<string, unknown> = {};

jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: routeParams }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
const projects = [
  { id: 'A', name: 'Project A', is_admin: true, timezone: 'UTC', created_at: '2026-01-01T00:00:00Z' },
  { id: 'B', name: 'Project B', is_admin: true, timezone: 'UTC', created_at: '2026-01-02T00:00:00Z' },
];
jest.mock('../../../../contexts/ProjectContext', () => ({
  useProjects: () => ({ projects, selectedProject: null, setSelectedProject: jest.fn() }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', timezone: 'UTC' } }) }));
jest.mock('../../../../shared/utils/calendarStorage', () => ({
  getSyncSettings: jest.fn(async () => ({ exportEnabled: false, exportCalendarId: null })),
}));
jest.mock('../../../../shared/services/calendar', () => ({ syncRehearsalToCalendar: jest.fn() }));
jest.mock('../../../../shared/services/api', () => ({
  projectsAPI: { getMembers: jest.fn(), getMembersAvailability: jest.fn() },
  rehearsalsAPI: { create: jest.fn(), update: jest.fn(), getById: jest.fn(), getResponses: jest.fn() },
}));

const member = (userId: string) => ({ userId, firstName: `Name${userId}`, lastName: '', role: 'member', status: 'active' });
const PEOPLE: Record<string, ReturnType<typeof member>[]> = {
  A: ['3', '7', '9'].map(member),
  B: ['21', '22'].map(member),
};
const getMembers = projectsAPI.getMembers as jest.Mock;
const create = rehearsalsAPI.create as jest.Mock;
const update = rehearsalsAPI.update as jest.Mock;
// The body of the last request: create sends (project, body, key), update
// (project, rehearsal, body).
const sentRoster = (call: jest.Mock) =>
  call.mock.calls.at(-1)?.find((arg: unknown) => typeof arg === 'object' && arg !== null)?.participant_ids;

beforeEach(() => {
  jest.clearAllMocks();
  getMembers.mockImplementation(async (projectId: string) => ({ data: { members: PEOPLE[projectId] } }));
  (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue({ data: { availability: [] } });
  create.mockResolvedValue({ data: { rehearsal: { id: 'new' } } });
  update.mockResolvedValue({ data: { rehearsal: { id: 'r1' } } });
  routeParams = { projectId: 'A', prefilledDate: '2026-11-10', prefilledTime: '10:00', prefilledEndTime: '12:00' };
});

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
async function open() {
  const screen = render(<AddRehearsalScreen />);
  await settle();
  await settle();
  return screen;
}
const pickProject = async (screen: ReturnType<typeof render>, shown: string, name: string) => {
  fireEvent.press(screen.getAllByText(shown)[0]);
  await settle();
  const items = screen.getAllByText(name);
  fireEvent.press(items[items.length - 1]);
  await settle();
  await settle();
};
const submit = async (screen: ReturnType<typeof render>, label = t.rehearsals.createRehearsal) => {
  fireEvent.press(screen.getByText(label));
  await settle();
  await settle();
};

describe('From the planner (DP02)', () => {
  it('saves the people the planner planned for, not the whole project', async () => {
    routeParams.prefilledMemberIds = ['3', '7'];
    const screen = await open();

    await submit(screen);

    expect(sentRoster(create)).toEqual(['3', '7']);
  });
});

describe('Picking the project (R9-01)', () => {
  it('picking the project already shown keeps the people', async () => {
    routeParams.prefilledMemberIds = ['3', '7'];
    const screen = await open();

    await pickProject(screen, 'Project A', 'Project A');
    await submit(screen);

    expect(sentRoster(create)).toEqual(['3', '7']);
  });

  it('back on the planner\'s project after one that failed to load, it starts with the planner\'s people again', async () => {
    routeParams.prefilledMemberIds = ['3', '7'];
    getMembers.mockImplementation(async (projectId: string) => {
      if (projectId === 'B') throw new Error('offline');
      return { data: { members: PEOPLE[projectId] } };
    });
    const screen = await open();

    await pickProject(screen, 'Project A', 'Project B');
    await pickProject(screen, 'Project B', 'Project A');
    await submit(screen);

    expect(sentRoster(create)).toEqual(['3', '7']);
  });

  it('an existing rehearsal stays in its project, and its saved roster is what is sent', async () => {
    routeParams = { rehearsalId: 'r1', projectId: 'A' };
    (rehearsalsAPI.getById as jest.Mock).mockResolvedValue({ data: { rehearsal: {
      id: 'r1', projectId: 'A', startsAt: '2026-11-10T10:00:00.000Z', endsAt: '2026-11-10T12:00:00.000Z' } } });
    (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({ data: { allParticipants: [{ userId: '9', response: 'no' }] } });
    const screen = await open();

    // Re-pick the project shown — the form used to empty the roster here.
    await pickProject(screen, 'Project A', 'Project A');
    await submit(screen, t.rehearsals.updateRehearsal);

    expect(sentRoster(update)).toEqual(['9']);
  });
});

describe('The participants row (T-010)', () => {
  const busyFor = (userId: string, start: string, end: string) => ({
    data: { availability: [{ userId, dates: [{ date: '2026-11-10', timeRanges: [{ start, end, type: 'busy' }] }] }] },
  });

  it('counts the people, and names someone picked who is busy at the time', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busyFor('7', '11:00', '14:00'));
    const screen = await open();
    await settle();

    expect(screen.getByTestId('participants-row').props.accessibilityLabel)
      .toBe('Participants, 3 of 3, Name7 busy 11:00–14:00');
    // The sheet: their busy time beside them, nobody else's.
    fireEvent.press(screen.getByTestId('participants-row'));
    expect(screen.getByTestId('participant-7').props.accessibilityLabel).toBe('Name7, 11:00–14:00');
    expect(screen.getByTestId('participant-3').props.accessibilityLabel).toBe('Name3');
  });

  it('says nothing for someone busy at another time of the day', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busyFor('7', '15:00', '18:00'));
    const screen = await open();
    await settle();

    expect(screen.getByTestId('participants-row').props.accessibilityLabel).toBe('Participants, 3 of 3');
    expect(screen.queryByTestId('participants-conflict')).toBeNull();
  });
});

describe('Before the people are known (R9-02)', () => {
  it('while the project\'s members are loading, Create sends nothing and says why', async () => {
    getMembers.mockImplementation(() => new Promise(() => { /* never answers */ }));
    routeParams.prefilledMemberIds = ['3', '7'];
    const screen = await open();

    await submit(screen);

    expect(create).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(t.common.error, t.rehearsals.participantsLoading);
  });

  it('after the load failed, Create sends nothing; trying again loads them, and then it saves', async () => {
    getMembers.mockRejectedValueOnce(new Error('offline'));
    routeParams.prefilledMemberIds = ['3', '7'];
    const screen = await open();

    await submit(screen);
    expect(create).not.toHaveBeenCalled();

    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    await act(async () => { buttons.find((b: { text: string }) => b.text === t.common.retry).onPress(); });
    await settle();
    await submit(screen);

    expect(sentRoster(create)).toEqual(['3', '7']);
  });
});
