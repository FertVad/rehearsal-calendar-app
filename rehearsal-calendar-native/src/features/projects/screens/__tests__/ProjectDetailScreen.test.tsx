/**
 * A project's rehearsals, upcoming and past, are drawn by one row (cause fix
 * 22: BC03). The past list was written out on its own and read only `scene`,
 * which no server sends: every past rehearsal was called "Rehearsal", with its
 * start time alone. The real screen, with the API and contexts standing in.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { projectsAPI, rehearsalsAPI, invitesAPI } from '../../../../shared/services/api';
import ProjectDetailScreen from '../ProjectDetailScreen';
import { translations } from '../../../../i18n/translations';
import { AxiosError } from 'axios';

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../contexts/ProjectContext', () => ({ useProjects: () => ({ refreshProjects: jest.fn() }) }));
jest.mock('../../../../shared/hooks/useClock', () => ({
  useToday: () => '2030-01-10',
  useTimezone: () => 'UTC',
}));
jest.mock('../../hooks', () => ({
  useInviteLink: () => ({ generateInviteLink: jest.fn(), generatingInvite: false, lastCode: null }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
// The page, with the scrolling the screen asks of it.
const mockScrollTo = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('../../../../__tests__/__mocks__/react-native.js');
  const ReactActual = jest.requireActual('react');
  const Plain = native.ScrollView;
  native.ScrollView = ReactActual.forwardRef((props: object, ref: unknown) => {
    ReactActual.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return ReactActual.createElement(Plain, props);
  });
  return native;
});
jest.mock('../../../../shared/services/api', () => ({
  projectsAPI: { getProject: jest.fn(), getMembers: jest.fn() },
  rehearsalsAPI: { getAll: jest.fn() },
  invitesAPI: { getInvite: jest.fn(), createInvite: jest.fn() },
}));

const rehearsal = (id: string, title: string, day: string) => ({
  id, title, projectId: 'p1', status: 'scheduled', location: 'Main hall',
  date: day, time: '18:00', endTime: '21:00',
  startsAt: `${day}T18:00:00.000Z`, endsAt: `${day}T21:00:00.000Z`,
});

beforeEach(() => {
  jest.clearAllMocks();
  (projectsAPI.getProject as jest.Mock).mockResolvedValue({
    data: { project: { id: 'p1', name: 'Hamlet', description: '', is_admin: false, is_owner: false, created_at: '2030-01-01' } },
  });
  (projectsAPI.getMembers as jest.Mock).mockResolvedValue({ data: { members: [] } });
  (rehearsalsAPI.getAll as jest.Mock).mockResolvedValue({
    data: {
      rehearsals: [
        rehearsal('r1', 'Act II blocking', '2030-01-12'),
        rehearsal('r2', 'Old monologue', '2030-01-07'),
      ],
    },
  });
});

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

it('names a past rehearsal by its title and times it as an upcoming one is', async () => {
  const screen = render(
    <ProjectDetailScreen
      route={{ key: 'ProjectDetail', name: 'ProjectDetail', params: { projectId: 'p1' } } as any}
      navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() } as any}
    />
  );
  await settle();
  await settle();

  fireEvent.press(screen.getByText('Upcoming Rehearsals'));
  fireEvent.press(screen.getByText('Past Rehearsals'));

  expect(screen.getByText('Act II blocking')).toBeTruthy();
  expect(screen.getByText('Old monologue')).toBeTruthy();
  // Both rows give the interval, from the same label.
  expect(screen.getAllByText('18:00–21:00')).toHaveLength(2);
});

// A project that could not be loaded says why, in the app's words: it said
// "Failed to load project" whether the phone was offline or the server down
// (T-228).
it("says there is no connection when the project could not be loaded for it (T-228)", async () => {
  const { Alert } = require('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (projectsAPI.getProject as jest.Mock).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK', undefined, {}));
  render(
    <ProjectDetailScreen
      route={{ key: 'ProjectDetail', name: 'ProjectDetail', params: { projectId: 'p1' } } as any}
      navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() } as any}
    />
  );
  await settle();

  expect(alert).toHaveBeenCalledWith(translations.en.common.error, translations.en.common.noConnection);
  alert.mockRestore();
});

describe('opened on its members (T-023)', () => {
  // "New member" opens the project on this section: scrolled there once the
  // page is laid out, no further than the page goes.
  const { ScrollView } = require('react-native');
  const scrollTo = mockScrollTo;

  const open = async (params: Record<string, unknown>) => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), setParams: jest.fn() };
    const screen = render(
      <ProjectDetailScreen
        route={{ key: 'ProjectDetail', name: 'ProjectDetail', params: { projectId: 'p1', ...params } } as any}
        navigation={navigation as any}
      />
    );
    await settle();
    await settle();
    return { screen, navigation };
  };
  const layOut = (screen: ReturnType<typeof render>, { view, page, members }: { view: number; page: number; members: number }) => {
    const scroll = screen.UNSAFE_getByType(ScrollView);
    act(() => {
      fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: view } } });
      fireEvent(scroll, 'contentSizeChange', 390, page);
      fireEvent(screen.getByTestId('project-members'), 'layout', { nativeEvent: { layout: { x: 0, y: members, width: 390, height: 300 } } });
    });
  };

  it('scrolls to the members, and asks it only once', async () => {
    const { screen, navigation } = await open({ section: 'members' });
    layOut(screen, { view: 700, page: 2000, members: 520 });

    expect(scrollTo).toHaveBeenCalledWith({ y: 520, animated: true });
    expect(navigation.setParams).toHaveBeenCalledWith({ section: undefined });
  });

  it('no further than the page goes', async () => {
    const { screen } = await open({ section: 'members' });
    layOut(screen, { view: 700, page: 1000, members: 520 });

    expect(scrollTo).toHaveBeenCalledWith({ y: 300, animated: true });
  });

  it('opened without a section, stays at the top', async () => {
    const { screen } = await open({});
    layOut(screen, { view: 700, page: 2000, members: 520 });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  // Project A left open and "New member" of B tapped: the navigator gives the
  // same screen B's id. A's page and its members' place are not B's — it
  // scrolled to where A's members were, before B had come, and then not again.
  it('opened from another project, scrolls to its own members once it has come', async () => {
    const { screen, navigation } = await open({});
    layOut(screen, { view: 700, page: 2000, members: 520 });

    let answerB: (value: unknown) => void = () => {};
    (projectsAPI.getProject as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { answerB = resolve; }));
    screen.rerender(
      <ProjectDetailScreen
        route={{ key: 'ProjectDetail', name: 'ProjectDetail', params: { projectId: 'p2', section: 'members' } } as any}
        navigation={navigation as any}
      />
    );
    await settle();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(navigation.setParams).not.toHaveBeenCalled();

    answerB({ data: { project: { id: 'p2', name: 'Macbeth', description: '', is_admin: false, is_owner: false, created_at: '2030-01-01' } } });
    await settle();
    await settle();
    expect(screen.getByText('Macbeth')).toBeTruthy();
    layOut(screen, { view: 700, page: 2400, members: 900 });

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 900, animated: true });
    expect(navigation.setParams).toHaveBeenCalledWith({ section: undefined });
  });
});

// A new rehearsal from the project's own page, by its upcoming ones (T-025):
// for the project's admins, the people the server lets put one in; the form
// opens on this project.
describe('"New rehearsal" (T-025)', () => {
  const open = async (isAdmin: boolean) => {
    (projectsAPI.getProject as jest.Mock).mockResolvedValue({
      data: { project: { id: 'p1', name: 'Hamlet', description: '', is_admin: isAdmin, is_owner: false, created_at: '2030-01-01' } },
    });
    (invitesAPI.getInvite as jest.Mock).mockResolvedValue({ data: { inviteCode: null } });
    const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), setParams: jest.fn() };
    const screen = render(
      <ProjectDetailScreen
        route={{ key: 'ProjectDetail', name: 'ProjectDetail', params: { projectId: 'p1' } } as any}
        navigation={navigation as any}
      />
    );
    await settle();
    await settle();
    return { screen, navigation };
  };

  it('opens the form on this project for its admin', async () => {
    const { screen, navigation } = await open(true);
    fireEvent.press(screen.getByTestId('project-new-rehearsal'));
    expect(navigation.navigate).toHaveBeenCalledWith('AddRehearsal', { projectId: 'p1' });
  });

  it('is not there for an actor', async () => {
    const { screen } = await open(false);
    expect(screen.queryByTestId('project-new-rehearsal')).toBeNull();
  });
});
