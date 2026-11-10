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
import { render, fireEvent, act, waitFor, within } from '@testing-library/react-native';
import { ActionSheetIOS, Alert } from 'react-native';
import { Colors } from '../../../../shared/constants/colors';
import { AxiosError } from 'axios';
import { translations } from '../../../../i18n/translations';
import { projectsAPI, rehearsalsAPI } from '../../../../shared/services/api';
import { setProfileTimezone } from '../../../../shared/utils/time';
import AddRehearsalScreen from '../AddRehearsalScreen';
import { PickerModal } from '../../../../shared/components/PickerModal';
// The shared stand-in (jest.config.js): what the form gives the calendar.
import { Calendar } from 'react-native-calendars';
// @ts-expect-error the mock's own helper (src/__tests__/__mocks__/expo-localization.js)
import { __changeCalendars } from 'expo-localization';

const t = translations.en;
let routeParams: Record<string, unknown> = {};

jest.mock('@react-native-community/datetimepicker', () => () => null);
// The library's own day, drawn in the date's tests, presses through this, and
// reads the writing direction when it loads (as in DateRangePicker.test).
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return { ...actual, TouchableWithoutFeedback: actual.TouchableOpacity, I18nManager: { isRTL: false } };
});
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
// The list as ProjectContext holds it now: read again behind the form, it is
// a new list of new objects (T-229).
const mockList: { current: typeof projects } = { current: projects };
jest.mock('../../../../contexts/ProjectContext', () => ({
  useProjects: () => ({ projects: mockList.current, selectedProject: null, setSelectedProject: jest.fn() }),
}));
const mockUser: { id: string; timezone: string; weekStartDay?: string } = { id: 'me', timezone: 'UTC' };
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../../shared/utils/calendarStorage', () => ({
  getSyncSettings: jest.fn(async () => ({ exportEnabled: false, exportCalendarId: null })),
}));
jest.mock('../../../../shared/services/calendar', () => ({ syncRehearsalToCalendar: jest.fn() }));
jest.mock('../../../../shared/services/api', () => ({
  projectsAPI: { getMembers: jest.fn(), getMembersAvailability: jest.fn(), getMembersAvailabilityRange: jest.fn() },
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

// The form starts a new rehearsal at the next whole hour, and after a create
// starts over from it: the clock is the test's, not the machine's. 22:30 in
// New York (jest.config.js) is the hour whose default three hours run past
// midnight, so the next day's busy time is asked for too. Only Date is faked:
// the timers stay real for settle().
const NOW = new Date('2026-10-31T02:30:00Z');

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
      'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
      'requestIdleCallback', 'cancelIdleCallback', 'hrtime', 'performance',
    ],
  });
  jest.clearAllMocks();
  mockGuard.prevent = false;
  mockGuard.callback = null;
  getMembers.mockImplementation(async (projectId: string) => ({ data: { members: PEOPLE[projectId] } }));
  (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue({ data: { availability: [] } });
  (projectsAPI.getMembersAvailabilityRange as jest.Mock).mockResolvedValue({ data: { availability: [] } });
  create.mockResolvedValue({ data: { rehearsal: { id: 'new' } } });
  update.mockResolvedValue({ data: { rehearsal: { id: 'r1' } } });
  routeParams = { projectId: 'A', prefilledDate: '2026-11-10', prefilledTime: '10:00' };
  mockList.current = projects;
});
afterEach(() => {
  jest.useRealTimers();
  delete mockUser.weekStartDay;
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
// Create or Save is offered: TouchableOpacity is a plain host here, so its
// `disabled` is read as given (on the phone it is the button's state).
const offered = (screen: ReturnType<typeof render>) => !screen.getByTestId('rehearsal-submit').props.disabled;
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
    // Update is offered once something is changed (T-018).
    act(() => { fireEvent.changeText(screen.getByTestId('rehearsal-location'), 'Hall'); });
    await submit(screen, t.rehearsals.updateRehearsal);

    expect(sentRoster(update)).toEqual(['9']);
  });
});

// The projects are read again behind an open form — back to the app, a push
// about a role, a 403 (T-229) — and the form is on what is chosen in it, with
// the role as it is now (T-229 review).
describe('The projects read again while the form is open (T-229 review)', () => {
  const readAgain = async (screen: ReturnType<typeof render>, change: (p: typeof projects[number]) => object = () => ({})) => {
    mockList.current = projects.map((p) => ({ ...p, ...change(p) }));
    screen.rerender(<AddRehearsalScreen />);
    await settle();
    await settle();
  };

  it('keeps the project picked in the form over the planner\'s, and creates it there', async () => {
    const screen = await open();
    await pickProject(screen, 'Project A', 'Project B');

    await readAgain(screen);
    await submit(screen);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toBe('B');
  });

  it('with the admin role taken off the project shown, Create is not offered and sends nothing', async () => {
    const screen = await open();
    expect(offered(screen)).toBe(true);

    await readAgain(screen, (p) => (p.id === 'A' ? { is_admin: false } : {}));

    expect(offered(screen)).toBe(false);
    expect(screen.getByTestId('rehearsal-project-error')).toBeTruthy();
    await submit(screen);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not load the members again for the same project read anew', async () => {
    const screen = await open();
    const loads = getMembers.mock.calls.length;

    await readAgain(screen);

    expect(getMembers).toHaveBeenCalledTimes(loads);
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

  // T-017 review r1: the phone's 12/24 hours changed while the form is open.
  // Every time on it follows, the ones it keeps memoized too; the form used to
  // show the start in the new way and the busy time in the old.
  it('follows the phone\'s 12/24 hours when it is changed with the form open', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busyFor('7', '11:00', '14:00'));
    const screen = await open();
    await settle();
    expect(screen.getByText('10:00')).toBeTruthy();

    try {
      act(() => __changeCalendars([{ uses24hourClock: false }]));

      expect(screen.getByText(/^10:00\sAM$/)).toBeTruthy();
      expect(screen.getByTestId('participants-conflict').props.children).toMatch(/^Name7 busy 11:00\sAM–2:00\sPM$/);
      fireEvent.press(screen.getByTestId('participants-row'));
      expect(screen.getByTestId('participant-7').props.accessibilityLabel).toMatch(/^Name7, 11:00\sAM–2:00\sPM$/);
    } finally {
      act(() => __changeCalendars([{ uses24hourClock: true }]));
    }
  });

  it('says nothing for someone busy at another time of the day', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busyFor('7', '15:00', '18:00'));
    const screen = await open();
    await settle();

    expect(screen.getByTestId('participants-row').props.accessibilityLabel).toBe('Participants, 3 of 3');
    expect(screen.queryByTestId('participants-conflict')).toBeNull();
  });
});

// T-238 (owner, 09.11): the form offered 13:00–14:00 as free time, a tap made
// it 13:00–16:00, and the same form then said someone was busy 14:00–17:00.
// What is tapped is what is put in: the usual length on, but no further than
// the free time goes.
describe('Recommended time (T-238)', () => {
  const busy = (ranges: Record<string, [string, string][]>) => ({
    data: { availability: Object.entries(ranges).map(([userId, times]) => ({
      userId,
      dates: [{ date: '2026-11-10', timeRanges: times.map(([start, end]) => ({ start, end, type: 'busy' })) }],
    })) },
  });
  const shown = (screen: ReturnType<typeof render>, testID: string) =>
    within(screen.getByTestId(testID)).getByText(/^\d\d:\d\d$/).props.children;
  // The style of the button a window is: the touchable around its text. Merged
  // by hand: StyleSheet here is the test setup's stand-in.
  const flat = (style: unknown): Record<string, unknown> =>
    Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const windowStyle = (screen: ReturnType<typeof render>, label: RegExp) => {
    let node: any = screen.getByText(label);
    while (node && !flat(node.props.style).borderColor) node = node.parent;
    return flat(node?.props.style);
  };
  const tapWindow = async (screen: ReturnType<typeof render>, label: RegExp) => {
    fireEvent.press(screen.getByText(label));
    await settle();
  };

  it('a window of 1 h with a usual 3 h: 13:00–14:00, and nobody is busy in it', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busy({ '7': [['09:00', '13:00']], '9': [['14:00', '17:00']] }));
    const screen = await open();

    await tapWindow(screen, /^13:00–14:00/);

    expect(shown(screen, 'rehearsal-start-time')).toBe('13:00');
    expect(shown(screen, 'rehearsal-end-time')).toBe('14:00');
    expect(screen.queryByTestId('participants-conflict')).toBeNull();
  });

  it('a window longer than the usual length: the usual length on (T-012)', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busy({ '7': [['09:00', '13:00']], '9': [['14:00', '17:00']] }));
    const screen = await open();

    await tapWindow(screen, /^17:00–23:00/);

    expect(shown(screen, 'rehearsal-start-time')).toBe('17:00');
    expect(shown(screen, 'rehearsal-end-time')).toBe('20:00');
  });

  it('everyone free all day: no 09:00–23:00 to tap, a line that says so', async () => {
    const screen = await open();
    await settle();

    expect(screen.queryByText(/^09:00–23:00/)).toBeNull();
    expect(screen.getByText(t.rehearsals.everyoneFreeAllDay)).toBeTruthy();
    // A line, not a button: the time is the form's own, the next whole hour.
    expect(shown(screen, 'rehearsal-start-time')).toBe('10:00');
  });

  it('someone busy at 14:00: the windows before and after are green, the colour of free', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busy({ '7': [['14:00', '17:00']] }));
    const screen = await open();

    for (const label of [/^09:00–14:00/, /^17:00–23:00/]) {
      const style = windowStyle(screen, label);
      expect(style.borderColor).toBe(Colors.accent.green);
      expect(style.backgroundColor).toBe(Colors.accent.greenAlpha15);
    }
  });

  it('from a planner slot an hour before someone is busy: it ends when they are', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busy({ '9': [['14:00', '17:00']] }));
    routeParams = { projectId: 'A', prefilledDate: '2026-11-10', prefilledTime: '13:00', prefilledFreeUntil: '14:00' };
    const screen = await open();
    await settle();

    expect(shown(screen, 'rehearsal-start-time')).toBe('13:00');
    expect(shown(screen, 'rehearsal-end-time')).toBe('14:00');
    expect(screen.queryByTestId('participants-conflict')).toBeNull();
  });

  it('lengthened by hand past the free time, it warns as before', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busy({ '7': [['09:00', '13:00']], '9': [['14:00', '17:00']] }));
    const screen = await open();
    await tapWindow(screen, /^13:00–14:00/);

    act(() => {
      const end = screen.UNSAFE_getAllByType(PickerModal).find((p) => p.props.title === t.rehearsals.selectEndTime)!;
      end.props.onConfirm(new Date(2026, 10, 10, 16, 0));
    });

    expect(shown(screen, 'rehearsal-end-time')).toBe('16:00');
    expect(screen.getByTestId('participants-conflict').props.children).toBe('Name9 busy 14:00–17:00');
  });

  // T-238 review: the start's picker confirmed as it was, or the day shown
  // tapped again, is no new start — the free time it came from still holds.
  const confirmStart = (screen: ReturnType<typeof render>, hours: number, minutes = 0) => act(() => {
    const start = screen.UNSAFE_getAllByType(PickerModal).find((p) => p.props.title === t.rehearsals.selectStartTime)!;
    start.props.onConfirm(new Date(2026, 10, 10, hours, minutes));
  });

  it('the start confirmed unchanged keeps 13:00–14:00, with nobody busy in it', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busy({ '7': [['09:00', '13:00']], '9': [['14:00', '17:00']] }));
    const screen = await open();
    await tapWindow(screen, /^13:00–14:00/);

    confirmStart(screen, 13);
    await settle();

    expect(shown(screen, 'rehearsal-end-time')).toBe('14:00');
    expect(screen.queryByTestId('participants-conflict')).toBeNull();
  });

  it('the day shown tapped again keeps 13:00–14:00, with nobody busy in it', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busy({ '7': [['09:00', '13:00']], '9': [['14:00', '17:00']] }));
    const screen = await open();
    await tapWindow(screen, /^13:00–14:00/);

    fireEvent.press(screen.getByTestId('rehearsal-date'));
    act(() => { screen.UNSAFE_getByType(Calendar).props.onDayPress({ dateString: '2026-11-10' }); });
    await settle();

    expect(shown(screen, 'rehearsal-end-time')).toBe('14:00');
    expect(screen.queryByTestId('participants-conflict')).toBeNull();
  });

  it('a start really moved is the person\'s own: the usual length on from it', async () => {
    (projectsAPI.getMembersAvailability as jest.Mock).mockResolvedValue(busy({ '7': [['09:00', '13:00']], '9': [['14:00', '17:00']] }));
    const screen = await open();
    await tapWindow(screen, /^13:00–14:00/);

    confirmStart(screen, 13, 30);
    await settle();

    expect(shown(screen, 'rehearsal-end-time')).toBe('16:30');
  });
});

describe('Before the people are known (R9-02)', () => {
  // The row says they are loading; Create is not offered until they are in,
  // with no alert on a tap (T-018).
  it('while the project\'s members are loading, Create is not offered and sends nothing', async () => {
    getMembers.mockImplementation(() => new Promise(() => { /* never answers */ }));
    routeParams.prefilledMemberIds = ['3', '7'];
    const screen = await open();

    expect(offered(screen)).toBe(false);
    await submit(screen);

    expect(create).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('after the load failed, it says so under the participants; trying again from there loads them, and then it saves', async () => {
    getMembers.mockRejectedValueOnce(new Error('offline'));
    routeParams.prefilledMemberIds = ['3', '7'];
    const screen = await open();

    expect(screen.getByTestId('rehearsal-participants-note').props.children).toBe(t.rehearsals.loadMembersError);
    expect(offered(screen)).toBe(false);
    await submit(screen);
    expect(create).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('rehearsal-participants-retry'));
    await settle();
    await settle();
    expect(screen.queryByTestId('rehearsal-participants-note')).toBeNull();
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

  // The header's Cancel (T-029) leaves as the cross did: by goBack, whose
  // removal the guard holds and asks about.
  it('Cancel in the header is that way out: goBack, held and asked about', async () => {
    const screen = await open();
    type(screen, 'Rehearsal room');
    mockNavigation.goBack.mockClear();

    fireEvent.press(screen.getByTestId('header-cancel'));

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(leave()).toBe(false);
    expect(showSheet).toHaveBeenCalledTimes(1);
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

      await act(async () => { fail(new AxiosError('Network Error', 'ERR_NETWORK', undefined, {})); });
      await settle();

      // Said in the app's language, not axios's "Network Error" (T-228).
      expect(Alert.alert).toHaveBeenCalledWith(t.common.error, t.common.noConnection);
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

describe('The form says what stops a save, under its field (T-018)', () => {
  // The profile in UTC, the phone in New York (jest.config.js): at NOW the
  // profile's today is the 31st, the phone's the 30th.
  beforeEach(() => setProfileTimezone('UTC'));
  afterEach(() => setProfileTimezone(null));
  // The end, as its picker would confirm it.
  const pickEnd = (screen: ReturnType<typeof render>, clock: string) => act(() => {
    const end = screen.UNSAFE_getAllByType(PickerModal).find((p) => p.props.title === t.rehearsals.selectEndTime)!;
    const [hours, minutes] = clock.split(':').map(Number);
    end.props.onConfirm(new Date(2026, 10, 10, hours, minutes));
  });
  const dateShown = (screen: ReturnType<typeof render>) => screen.getByTestId('rehearsal-date');
  const calendar = (screen: ReturnType<typeof render>) => screen.UNSAFE_queryByType(Calendar);
  // A day as the library draws it from what the form gives the calendar: one
  // that takes no tap is a disabled touchable, and its press goes nowhere.
  const takesTap = (screen: ReturnType<typeof render>, date: string) => {
    const LibraryDay = jest.requireActual('react-native-calendars/src/calendar/day').default;
    const { dayComponent, markedDates } = calendar(screen)!.props;
    const onPress = jest.fn();
    // Drawn apart from the screen: a second render() of the testing library
    // left the form's buttons taking no press.
    const TestRenderer = require('react-test-renderer');
    let drawn: any;
    act(() => {
      drawn = TestRenderer.create(
        <LibraryDay date={date} markingType="period" marking={markedDates[date]} dayComponent={dayComponent} onPress={onPress} />
      );
    });
    // The touchable itself: a press goes to it, not to the components around.
    const touchable = drawn!.root.findByProps({ accessible: true });
    if (!touchable.props.disabled) act(() => touchable.props.onPress?.());
    act(() => drawn!.unmount());
    return onPress.mock.calls.length > 0;
  };
  // A tap on a day that takes it; the day's availability comes in after.
  const tapDay = async (screen: ReturnType<typeof render>, date: string) => {
    if (takesTap(screen, date)) act(() => { calendar(screen)!.props.onDayPress({ dateString: date }); });
    await settle();
  };

  it('an end at the start says so under the end at once, and Create is not offered; no alert', async () => {
    const screen = await open();
    expect(screen.queryByTestId('rehearsal-end-time-error')).toBeNull();

    pickEnd(screen, '10:00');

    expect(screen.getByTestId('rehearsal-end-time-error').props.children).toBe(t.rehearsals.endTimeError);
    expect(offered(screen)).toBe(false);
    await submit(screen);
    expect(create).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();

    pickEnd(screen, '12:00');
    expect(screen.queryByTestId('rehearsal-end-time-error')).toBeNull();
    expect(offered(screen)).toBe(true);
  });

  it('no project says so under the project, and Create is not offered; no alert', async () => {
    const shown = projects.splice(0);
    try {
      routeParams = {};
      const screen = await open();

      expect(screen.getByTestId('rehearsal-project-error').props.children).toBe(t.rehearsals.projectNotSelected);
      expect(offered(screen)).toBe(false);
      await submit(screen);
      expect(create).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    } finally {
      projects.push(...shown);
    }
  });

  it('while the day\'s availability is on its way, it says so under the participants, and Create waits', async () => {
    let answer: (value: unknown) => void = () => undefined;
    (projectsAPI.getMembersAvailability as jest.Mock).mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const screen = await open();

    expect(screen.getByTestId('rehearsal-participants-note').props.children).toBe(t.rehearsals.availabilityChecking);
    expect(offered(screen)).toBe(false);

    await act(async () => { answer({ data: { availability: [] } }); });
    await settle();
    expect(screen.queryByTestId('rehearsal-participants-note')).toBeNull();
    expect(offered(screen)).toBe(true);
  });

  it('the date is a month in the form: its weekday shown, the days before today take no tap', async () => {
    const screen = await open();
    expect(dateShown(screen)).toHaveTextContent(/Tuesday, November 10, 2026/);
    // No wheels for the date: its month opens under it, in the form.
    expect(screen.UNSAFE_getAllByType(PickerModal).map((p) => p.props.mode)).toEqual(['time', 'time']);
    expect(calendar(screen)).toBeNull();

    fireEvent.press(dateShown(screen));
    expect(calendar(screen)!.props.markedDates['2026-11-10']).toMatchObject({ startingDay: true, endingDay: true });
    // Today is the profile's: the phone's 30th is past.
    expect(takesTap(screen, '2026-10-31')).toBe(true);
    expect(takesTap(screen, '2026-10-30')).toBe(false);
    expect(takesTap(screen, '2026-10-26')).toBe(false);
    expect(takesTap(screen, '2026-11-12')).toBe(true);

    await tapDay(screen, '2026-10-30');
    expect(dateShown(screen)).toHaveTextContent(/Tuesday, November 10, 2026/);
    await tapDay(screen, '2026-11-12');
    expect(dateShown(screen)).toHaveTextContent(/Thursday, November 12, 2026/);
    await tapDay(screen, '2026-10-31');
    expect(dateShown(screen)).toHaveTextContent(/Saturday, October 31, 2026/);
    await submit(screen);
    expect(create.mock.calls[0][1].startsAt).toBe('2026-10-31T10:00:00.000Z');
  });

  it('its week begins on the profile\'s first day', async () => {
    const monday = await open();
    fireEvent.press(dateShown(monday));
    expect(calendar(monday)!.props.firstDay).toBe(1);
    monday.unmount();

    mockUser.weekStartDay = 'sunday';
    const sunday = await open();
    fireEvent.press(dateShown(sunday));
    expect(calendar(sunday)!.props.firstDay).toBe(0);
  });

  describe('An edit', () => {
    const editOf = (startsAt: string, endsAt: string) => {
      routeParams = { rehearsalId: 'r1', projectId: 'A' };
      (rehearsalsAPI.getById as jest.Mock).mockResolvedValue({ data: { rehearsal: { id: 'r1', projectId: 'A', startsAt, endsAt } } });
      (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({ data: { allParticipants: [{ userId: '9', response: 'no' }] } });
    };

    it('Save is not offered until something is changed, and is once it is', async () => {
      editOf('2026-11-10T10:00:00.000Z', '2026-11-10T12:00:00.000Z');
      const screen = await open();

      expect(offered(screen)).toBe(false);
      await submit(screen, t.rehearsals.updateRehearsal);
      expect(update).not.toHaveBeenCalled();

      act(() => { fireEvent.changeText(screen.getByTestId('rehearsal-location'), 'Hall'); });
      expect(offered(screen)).toBe(true);
      // Put back as it was, it is not a change again (T-013).
      act(() => { fireEvent.changeText(screen.getByTestId('rehearsal-location'), ''); });
      expect(offered(screen)).toBe(false);
    });

    it('one in the past keeps its own day shown and chosen; the other past days take no tap', async () => {
      editOf('2026-10-20T10:00:00.000Z', '2026-10-20T12:00:00.000Z');
      const screen = await open();
      expect(dateShown(screen)).toHaveTextContent(/Tuesday, October 20, 2026/);

      fireEvent.press(dateShown(screen));
      expect(calendar(screen)!.props.markedDates['2026-10-20']).toMatchObject({ startingDay: true, endingDay: true });
      expect(takesTap(screen, '2026-10-20')).toBe(true);
      expect(takesTap(screen, '2026-10-19')).toBe(false);
      expect(takesTap(screen, '2026-10-21')).toBe(false);
      await tapDay(screen, '2026-10-21');
      expect(dateShown(screen)).toHaveTextContent(/Tuesday, October 20, 2026/);
      expect(offered(screen)).toBe(false);

      await tapDay(screen, '2026-10-31');
      expect(dateShown(screen)).toHaveTextContent(/Saturday, October 31, 2026/);
      expect(offered(screen)).toBe(true);
      // Back on its own day, which still takes the tap: nothing is changed.
      await tapDay(screen, '2026-10-20');
      expect(dateShown(screen)).toHaveTextContent(/Tuesday, October 20, 2026/);
      expect(offered(screen)).toBe(false);
    });
  });
});
