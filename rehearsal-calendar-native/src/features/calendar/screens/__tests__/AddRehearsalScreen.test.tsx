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
import { ActionSheetIOS, Alert } from 'react-native';
import { translations } from '../../../../i18n/translations';
import { projectsAPI, rehearsalsAPI } from '../../../../shared/services/api';
import AddRehearsalScreen from '../AddRehearsalScreen';

const t = translations.en;
let routeParams: Record<string, unknown> = {};

jest.mock('@react-native-community/datetimepicker', () => () => null);
// One navigation for the screen and its hooks; the guard on its removal is
// kept so a test can play a way out (T-013).
const mockNavigation = { navigate: jest.fn(), goBack: jest.fn(), dispatch: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const mockGuard: { prevent: boolean; callback: ((e: { data: { action: object } }) => void) | null } = { prevent: false, callback: null };
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: routeParams }),
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn(),
  usePreventRemove: (prevent: boolean, callback: typeof mockGuard.callback) => {
    mockGuard.prevent = prevent;
    mockGuard.callback = callback;
  },
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
  mockGuard.prevent = false;
  mockGuard.callback = null;
  getMembers.mockImplementation(async (projectId: string) => ({ data: { members: PEOPLE[projectId] } }));
  (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue({ data: { availability: [] } });
  create.mockResolvedValue({ data: { rehearsal: { id: 'new' } } });
  update.mockResolvedValue({ data: { rehearsal: { id: 'r1' } } });
  routeParams = { projectId: 'A', prefilledDate: '2026-11-10', prefilledTime: '10:00' };
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

describe('Leaving with changes (T-013)', () => {
  const showSheet = ActionSheetIOS.showActionSheetWithOptions as jest.Mock;
  // A way out — the close button, the swipe, back: true when it goes through.
  const leave = (action: object = { type: 'GO_BACK' }) => {
    if (!mockGuard.prevent) return true;
    mockGuard.callback!({ data: { action } });
    return false;
  };
  const choose = async (label: string) => {
    const [{ options }, answer] = showSheet.mock.calls.at(-1);
    await act(async () => { answer(options.indexOf(label)); });
    await settle();
  };
  const type = (screen: ReturnType<typeof render>, text: string) =>
    act(() => { fireEvent.changeText(screen.getByTestId('rehearsal-location'), text); });

  it('untouched, the form closes at once: what it filled in by itself is not a change', async () => {
    routeParams.prefilledMemberIds = ['3', '7'];
    await open();

    expect(leave()).toBe(true);
    expect(showSheet).not.toHaveBeenCalled();
  });

  it('an edit closes at once once it has loaded, untouched', async () => {
    routeParams = { rehearsalId: 'r1', projectId: 'A' };
    (rehearsalsAPI.getById as jest.Mock).mockResolvedValue({ data: { rehearsal: {
      id: 'r1', projectId: 'A', title: 'Act I', location: 'Hall',
      startsAt: '2026-11-10T10:00:00.000Z', endsAt: '2026-11-10T12:00:00.000Z' } } });
    (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({ data: { allParticipants: [{ userId: '9', response: 'no' }] } });
    await open();

    expect(leave()).toBe(true);
  });

  it('something typed, a way out asks: Don\'t Save, Save, Cancel', async () => {
    const screen = await open();
    type(screen, 'Rehearsal room');

    expect(leave()).toBe(false);
    expect(showSheet.mock.calls[0][0]).toMatchObject({
      options: [t.common.dontSave, t.common.save, t.common.cancel],
      destructiveButtonIndex: 0,
      cancelButtonIndex: 2,
    });
  });

  it('Don\'t Save closes it the way it was being closed, and nothing is sent', async () => {
    const screen = await open();
    type(screen, 'Rehearsal room');
    const swipe = { type: 'POP', payload: { count: 1 } };

    leave(swipe);
    await choose(t.common.cancel);
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();

    leave(swipe);
    await choose(t.common.dontSave);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(swipe);
    expect(create).not.toHaveBeenCalled();
  });

  it('typed and put back as it was is not a change', async () => {
    const screen = await open();
    type(screen, 'Rehearsal room');
    type(screen, '');

    expect(leave()).toBe(true);
  });

  it('Save creates it, and the way out after that is not asked about', async () => {
    const screen = await open();
    type(screen, 'Rehearsal room');

    leave();
    await choose(t.common.save);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toMatchObject({ location: 'Rehearsal room' });
    expect(leave()).toBe(true);
  });

  describe('While a save is out, the form is the one being saved (T-013, review 2)', () => {
    // The create request, answered when the test says.
    let answer: (value: unknown) => void;
    let fail: (error: Error) => void;
    beforeEach(() => {
      create.mockImplementation(() => new Promise((resolve, reject) => { answer = resolve; fail = reject; }));
    });
    const location = (screen: ReturnType<typeof render>) => screen.getByTestId('rehearsal-location').props.value;
    const closes = () => mockNavigation.dispatch.mock.calls.length + mockNavigation.goBack.mock.calls.length;
    const pressOk = async () => {
      const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.find(([title]) => title === t.rehearsals.success);
      await act(async () => { buttons[0].onPress(); });
      await settle();
    };

    it('the question\'s Save: no edits meanwhile, no way out until it is back, then closed once', async () => {
      const screen = await open();
      type(screen, 'Room A');
      leave();
      await choose(t.common.save);

      type(screen, 'Room B');
      expect(location(screen)).toBe('Room A');
      expect(leave()).toBe(false);
      expect(showSheet).toHaveBeenCalledTimes(1);
      expect(closes()).toBe(0);

      await act(async () => { answer({ data: { rehearsal: { id: 'new' } } }); });
      await settle();

      // Closed by the guard, the way it was being closed: no alert over it.
      expect(create.mock.calls[0][1]).toMatchObject({ location: 'Room A' });
      expect(closes()).toBe(1);
      expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
      expect(Alert.alert).not.toHaveBeenCalledWith(t.rehearsals.success, expect.anything(), expect.anything());
    });

    it('Create: no edits meanwhile, and saved is what was sent', async () => {
      const screen = await open();
      type(screen, 'Room A');
      await submit(screen);

      type(screen, 'Room B');
      expect(location(screen)).toBe('Room A');
      expect(leave()).toBe(false);
      expect(showSheet).not.toHaveBeenCalled();

      await act(async () => { answer({ data: { rehearsal: { id: 'new' } } }); });
      await settle();
      await pressOk();

      expect(create).toHaveBeenCalledTimes(1);
      expect(closes()).toBe(1);
    });

    it('a save that fails keeps the edits, says so, and the form takes edits again', async () => {
      const screen = await open();
      type(screen, 'Room A');
      leave();
      await choose(t.common.save);

      await act(async () => { fail(new Error('offline')); });
      await settle();

      expect(Alert.alert).toHaveBeenCalledWith(t.common.error, 'offline');
      expect(closes()).toBe(0);
      type(screen, 'Room B');
      expect(location(screen)).toBe('Room B');
      expect(leave()).toBe(false);
      expect(showSheet).toHaveBeenCalledTimes(2);
    });
  });

  it('while the people are still loading, Save is not offered', async () => {
    getMembers.mockImplementation(() => new Promise(() => { /* never answers */ }));
    const screen = await open();
    type(screen, 'Rehearsal room');

    leave();

    expect(showSheet.mock.calls[0][0]).toMatchObject({ options: [t.common.dontSave, t.common.cancel] });
  });
});
