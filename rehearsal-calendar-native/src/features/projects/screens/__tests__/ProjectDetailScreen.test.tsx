/**
 * A project's rehearsals, upcoming and past, are drawn by one row (cause fix
 * 22: BC03). The past list was written out on its own and read only `scene`,
 * which no server sends: every past rehearsal was called "Rehearsal", with its
 * start time alone. The real screen, with the API and contexts standing in.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { projectsAPI, rehearsalsAPI } from '../../../../shared/services/api';
import ProjectDetailScreen from '../ProjectDetailScreen';

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
  expect(screen.getAllByText('18:00 — 21:00')).toHaveLength(2);
});
