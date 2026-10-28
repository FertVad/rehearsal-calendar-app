/**
 * The projects are the session's (cause fix 12: BC01, BC02).
 *
 * The provider sits above the navigator, so a sign-out does not unmount it:
 * the list and the chosen project of one person stayed for the next, and the
 * rehearsal form opened on a project the new person could not use (BC01). The
 * chosen project was a copy taken when it was picked, so a deleted project or
 * a lost admin role stayed chosen after every reload (BC02).
 */
import React from 'react';
import { Text } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import { ProjectProvider, useProjects } from '../ProjectContext';
import { changeOwner, resetSessionForTests, restoreOwner } from '../../shared/services/session';

const mockGetUserProjects = jest.fn();
jest.mock('../../shared/services/api', () => ({
  projectsAPI: { getUserProjects: (...args: any[]) => mockGetUserProjects(...args) },
}));

const mockAuth: { user: { id: number } | null } = { user: { id: 1 } };
jest.mock('../AuthContext', () => ({ useAuth: () => mockAuth }));

const project = (id: string, name: string, isAdmin = true) => ({ id, name, is_admin: isAdmin }) as any;
const ORCHARD = project('p1', 'The Cherry Orchard');
const ESTATE = project('p2', 'The Estate');
const LOPAKHIN = project('q1', 'Lopakhin Holdings');

let projects: ReturnType<typeof useProjects>;
function Probe() {
  projects = useProjects();
  return (
    <>
      <Text testID="list">{projects.projects.map((p) => p.name).join(',')}</Text>
      <Text testID="selected">{projects.selectedProject?.name ?? 'none'}</Text>
    </>
  );
}

function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}
const answer = (list: any[]) => ({ data: { projects: list } });
const text = (screen: ReturnType<typeof render>, id: string) => screen.getByTestId(id).props.children;

beforeEach(() => {
  mockGetUserProjects.mockReset();
  mockAuth.user = { id: 1 };
  resetSessionForTests();
  restoreOwner(1);
});

// A sign-out and another person's sign-in, as the AuthContext makes them.
async function switchTo(screen: ReturnType<typeof render>, id: number) {
  await act(async () => {
    mockAuth.user = null;
    await changeOwner(null);
  });
  screen.rerender(<ProjectProvider><Probe /></ProjectProvider>);
  await act(async () => {
    mockAuth.user = { id };
    await changeOwner(id);
  });
  screen.rerender(<ProjectProvider><Probe /></ProjectProvider>);
}

describe('Across accounts (BC01)', () => {
  it('shows the next person neither the list nor the choice of the previous one', async () => {
    mockGetUserProjects.mockResolvedValue(answer([ORCHARD, ESTATE]));
    const screen = render(<ProjectProvider><Probe /></ProjectProvider>);
    await waitFor(() => expect(text(screen, 'list')).toBe('The Cherry Orchard,The Estate'));
    act(() => projects.setSelectedProject(ESTATE));
    expect(text(screen, 'selected')).toBe('The Estate');

    const next = held<any>();
    mockGetUserProjects.mockReturnValue(next.promise);
    await switchTo(screen, 2);
    expect(text(screen, 'list')).toBe('');
    expect(text(screen, 'selected')).toBe('none');

    await act(async () => { next.resolve(answer([project('p1', 'The Cherry Orchard', false), LOPAKHIN])); });
    expect(text(screen, 'list')).toBe('The Cherry Orchard,Lopakhin Holdings');
    // The previous person's choice is not carried over, nor their admin role.
    expect(projects.selectedProject).toMatchObject({ id: 'p1', is_admin: false });
  });

  it('drops the previous person\'s list when it answers after the change', async () => {
    const late = held<any>();
    mockGetUserProjects.mockReturnValueOnce(late.promise);
    const screen = render(<ProjectProvider><Probe /></ProjectProvider>);

    mockGetUserProjects.mockResolvedValue(answer([LOPAKHIN]));
    await switchTo(screen, 2);
    await waitFor(() => expect(text(screen, 'list')).toBe('Lopakhin Holdings'));

    await act(async () => { late.resolve(answer([ORCHARD, ESTATE])); });
    expect(text(screen, 'list')).toBe('Lopakhin Holdings');
  });
});

describe('The chosen project is the list\'s (BC02)', () => {
  it('moves to a project that is still there when the chosen one was deleted', async () => {
    mockGetUserProjects.mockResolvedValue(answer([ORCHARD, ESTATE]));
    const screen = render(<ProjectProvider><Probe /></ProjectProvider>);
    await waitFor(() => expect(text(screen, 'list')).toBe('The Cherry Orchard,The Estate'));
    act(() => projects.setSelectedProject(ESTATE));

    mockGetUserProjects.mockResolvedValue(answer([ORCHARD]));
    await act(async () => { await projects.refreshProjects(); });

    expect(text(screen, 'selected')).toBe('The Cherry Orchard');
  });

  it('reads the role as the latest list has it', async () => {
    mockGetUserProjects.mockResolvedValue(answer([ORCHARD, ESTATE]));
    render(<ProjectProvider><Probe /></ProjectProvider>);
    await waitFor(() => expect(projects.projects).toHaveLength(2));
    act(() => projects.setSelectedProject(ESTATE));

    mockGetUserProjects.mockResolvedValue(answer([ORCHARD, project('p2', 'The Estate', false)]));
    await act(async () => { await projects.refreshProjects(); });

    expect(projects.selectedProject).toMatchObject({ id: 'p2', is_admin: false });
  });

  it('keeps the newest list when an older load answers last', async () => {
    const older = held<any>();
    mockGetUserProjects.mockReturnValueOnce(older.promise);
    const screen = render(<ProjectProvider><Probe /></ProjectProvider>);

    mockGetUserProjects.mockResolvedValue(answer([ORCHARD]));
    await act(async () => { await projects.refreshProjects(); });
    await act(async () => { older.resolve(answer([ORCHARD, ESTATE])); });

    expect(text(screen, 'list')).toBe('The Cherry Orchard');
  });
});
