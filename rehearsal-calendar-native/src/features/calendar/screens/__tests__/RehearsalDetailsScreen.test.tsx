/**
 * The details of a rehearsal read and write one "seen" model, the store's
 * (cause fix 22: DD01).
 *
 * Details used to keep a second copy — its own row and count from the
 * participants answer — while the toggle worked from SeenContext's. These tests
 * drive the real screen under the real store, with a card beside it reading the
 * same store, and only the API, navigation and the other contexts standing in.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { rehearsalsAPI } from '../../../../shared/services/api';
import { SeenProvider, useSeen } from '../../../../contexts/SeenContext';
import { emitDataChanged } from '../../../../shared/utils/dataChanged';
import { translations } from '../../../../i18n/translations';
import RehearsalDetailsScreen from '../RehearsalDetailsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { rehearsalId: 'r1' } }),
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));
jest.mock('../../../../shared/services/calendarSync', () => ({
  unexportRehearsal: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
let isAdmin = false;
// Empty until the list has loaded: opened from a notification, it may come late.
let projectsLoaded = true;
jest.mock('../../../../contexts/ProjectContext', () => ({
  useProjects: () => ({ projects: projectsLoaded ? [{ id: 'p1', name: 'Hamlet', is_admin: isAdmin }] : [] }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, timezone: 'UTC' } }) }));
jest.mock('../../../../shared/services/api', () => ({
  rehearsalsAPI: { getById: jest.fn(), getResponses: jest.fn(), respond: jest.fn(), delete: jest.fn() },
}));

const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
const getResponses = rehearsalsAPI.getResponses as jest.Mock;
const respond = rehearsalsAPI.respond as jest.Mock;

/** What the server says about the people on r1: me (7) and one other. */
function answer(mine: 'yes' | 'no', other: 'yes' | 'no' = 'no') {
  const confirmed = [mine, other].filter((r) => r === 'yes').length;
  getResponses.mockResolvedValue({
    data: {
      allParticipants: [
        { userId: '7', firstName: 'Me', lastName: 'Self', response: mine },
        { userId: '8', firstName: 'Other', lastName: 'Actor', response: other },
      ],
      stats: { confirmed, invited: 2 },
    },
  });
}

/** A card elsewhere in the app: what the store says about r1. */
function Card() {
  const { responseFor } = useSeen();
  return <Text testID="card">{String(responseFor('r1'))}</Text>;
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const tree = () => (
  <SeenProvider>
    <Card />
    <RehearsalDetailsScreen />
  </SeenProvider>
);
async function open() {
  const screen = render(tree());
  await settle();
  await settle();
  return screen;
}
// The eyes of the participant rows; the admin's count badge has one too.
const seenEyes = (screen: ReturnType<typeof render>) =>
  screen.queryAllByTestId('icon-Ionicons-eye').length - (isAdmin ? 1 : 0);

beforeEach(() => {
  jest.clearAllMocks();
  isAdmin = false;
  projectsLoaded = true;
  (rehearsalsAPI.getById as jest.Mock).mockResolvedValue({
    data: {
      rehearsal: {
        id: 'r1', projectId: 'p1', title: 'Act I run-through',
        startsAt: '2030-01-10T18:00:00.000Z', endsAt: '2030-01-10T21:00:00.000Z',
      },
    },
  });
});

describe('Rehearsal details: one "seen" model (DD01)', () => {
  it('takes the mark back when opened before the calendar primed the store', async () => {
    // Opened from a notification: nothing has primed the store. The server
    // says this person has seen it; the tap means "not seen".
    answer('yes');
    respond.mockResolvedValue({ data: { confirmed: 0, invited: 2 } });
    const screen = await open();
    expect(seenEyes(screen)).toBe(1);
    expect(screen.getByTestId('card').props.children).toBe('yes');

    fireEvent.press(screen.getByText('Me Self'));
    await settle();

    expect(respond).toHaveBeenCalledWith('r1', 'no');
    expect(seenEyes(screen)).toBe(0);
    expect(screen.getByTestId('card').props.children).toBe('null');
  });

  it('puts its own row back when the tap fails, as the card is put back', async () => {
    answer('no');
    respond.mockRejectedValue(new Error('offline'));
    const screen = await open();
    expect(seenEyes(screen)).toBe(0);

    fireEvent.press(screen.getByText('Me Self'));
    await settle();

    expect(alertSpy).toHaveBeenCalled();
    expect(screen.getByTestId('card').props.children).toBe('null');
    expect(seenEyes(screen)).toBe(0);
  });

  it("shows the server's count after the tap, not the one from before it", async () => {
    isAdmin = true;
    answer('no');
    respond.mockResolvedValue({ data: { confirmed: 1, invited: 2 } });
    const screen = await open();
    expect(screen.getByText('0/2')).toBeTruthy();

    fireEvent.press(screen.getByText('Me Self'));
    await settle();

    expect(respond).toHaveBeenCalledWith('r1', 'yes');
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('shows the count when the projects come after the participants (review)', async () => {
    // Opened from a notification by an admin who is not on the rehearsal: the
    // participants answer lands before the project list says "admin", and the
    // calendar has nothing to fill the count in with.
    isAdmin = true;
    projectsLoaded = false;
    answer('no', 'yes');
    const screen = await open();
    expect(screen.queryByText('1/2')).toBeNull();

    projectsLoaded = true;
    screen.rerender(tree());
    await settle();

    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('keeps the others as the server gave them', async () => {
    answer('no', 'yes');
    const screen = await open();
    await waitFor(() => expect(seenEyes(screen)).toBe(1));
    expect(screen.getByTestId('card').props.children).toBe('null');
  });
});

describe('Rehearsal details: Edit and Delete (T-016)', () => {
  it("gives an admin Edit, which opens the form on this rehearsal", async () => {
    isAdmin = true;
    answer('no');
    const screen = await open();

    fireEvent.press(screen.getByText('Edit'));

    expect(mockNavigate).toHaveBeenCalledWith('AddRehearsal', { rehearsalId: 'r1', projectId: 'p1' });
  });

  it('asks with the name, the day and the time, and who will be told', async () => {
    isAdmin = true;
    answer('no');
    const screen = await open();

    fireEvent.press(screen.getByTestId('rehearsal-details-delete'));
    await settle();

    const [title, message, buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1] as any[];
    expect(title).toBe('Delete “Act I run-through”, Thu Jan 10, 18:00?');
    // Everyone on it but whoever deletes it: the other actor.
    expect(message).toBe('Participants (1) will be notified');
    expect(buttons.map((b: any) => [b.text, b.style])).toEqual([['Cancel', 'cancel'], ['Delete', 'destructive']]);
  });

  it('says nothing of notifications when nobody else is on it', async () => {
    isAdmin = true;
    getResponses.mockResolvedValue({
      data: { allParticipants: [{ userId: '7', firstName: 'Me', lastName: 'Self', response: 'no' }] },
    });
    const screen = await open();

    fireEvent.press(screen.getByTestId('rehearsal-details-delete'));
    await settle();

    const [, message] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1] as any[];
    expect(message).toBeUndefined();
  });

  it('deletes, closes the sheet and tells the lists', async () => {
    isAdmin = true;
    answer('no');
    (rehearsalsAPI.delete as jest.Mock).mockResolvedValue({ data: { success: true } });
    const listChanged = jest.fn();
    const stop = require('../../../../shared/utils/dataChanged').onDataChanged('rehearsals', listChanged);
    const screen = await open();

    fireEvent.press(screen.getByTestId('rehearsal-details-delete'));
    await settle();
    const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1] as any[];
    await act(async () => { await buttons.find((b: any) => b.style === 'destructive').onPress(); });
    stop();

    expect(rehearsalsAPI.delete).toHaveBeenCalledWith('p1', 'r1');
    expect(mockGoBack).toHaveBeenCalled();
    expect(listChanged).toHaveBeenCalled();
  });

  it('does not ask without the count when who is on it could not be read, and reads it again (review)', async () => {
    isAdmin = true;
    answer('no');
    const screen = await open();
    getResponses.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));

    fireEvent.press(screen.getByTestId('rehearsal-details-delete'));
    await settle();

    // An error, not a confirmation without its line: nothing to delete from.
    const [title, message, buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1] as any[];
    expect(title).toBe('Error');
    expect(message).toBe(translations.en.rehearsals.deleteNotifiedUnknown);
    expect(buttons.map((b: any) => b.text)).toEqual(['Cancel', 'Try again']);
    expect(buttons.some((b: any) => b.style === 'destructive')).toBe(false);

    await act(async () => { buttons[1].onPress(); });
    await settle();

    const [title2, message2] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1] as any[];
    expect(title2).toBe('Delete “Act I run-through”, Thu Jan 10, 18:00?');
    expect(message2).toBe('Participants (1) will be notified');
  });

  it('keeps the details when a read again fails, and takes the next one (review)', async () => {
    isAdmin = true;
    answer('no');
    const getById = rehearsalsAPI.getById as jest.Mock;
    const screen = await open();

    // Saved in the form: read again, on a network that drops it.
    getById.mockRejectedValueOnce(new Error('Network Error'));
    act(() => emitDataChanged('rehearsals'));
    await settle();
    await settle();

    expect(screen.queryByText(translations.en.rehearsals.notFound)).toBeNull();
    expect(screen.getByText('Act I run-through')).toBeTruthy();
    expect(screen.getByTestId('rehearsal-details-edit')).toBeTruthy();
    expect(screen.getByTestId('rehearsal-details-delete')).toBeTruthy();

    // The next read comes through, and is what the sheet shows.
    getById.mockResolvedValueOnce({
      data: {
        rehearsal: {
          id: 'r1', projectId: 'p1', title: 'Act I run-through', location: 'Battlements',
          startsAt: '2030-01-10T18:00:00.000Z', endsAt: '2030-01-10T21:00:00.000Z',
        },
      },
    });
    act(() => emitDataChanged('rehearsals'));
    await settle();
    await settle();

    expect(screen.getByText('Battlements')).toBeTruthy();
    expect(screen.getByTestId('rehearsal-details-edit')).toBeTruthy();
  });

  it('says "not found" when a read again finds it gone', async () => {
    answer('no');
    const screen = await open();

    (rehearsalsAPI.getById as jest.Mock).mockRejectedValueOnce({ response: { status: 404 } });
    act(() => emitDataChanged('rehearsals'));
    await settle();

    expect(screen.getByText(translations.en.rehearsals.notFound)).toBeTruthy();
  });

  it('gives an actor neither', async () => {
    answer('no');
    const screen = await open();

    expect(screen.queryByTestId('rehearsal-details-edit')).toBeNull();
    expect(screen.queryByTestId('rehearsal-details-delete')).toBeNull();
  });
});
