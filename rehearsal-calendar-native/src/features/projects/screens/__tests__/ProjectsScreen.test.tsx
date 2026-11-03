/**
 * A card on the projects list is the project's name, role and description
 * (T-025). An admin's card also carried "Invite" and the invite code — about
 * 90 of its 155–163 pt — which the project's own page has; and a tick marked
 * the project opened last. Both are gone; opening a project still makes it the
 * one the new rehearsal form offers.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProjectsScreen from '../ProjectsScreen';

const mockNavigate = jest.fn();
const mockSetSelectedProject = jest.fn();
const projects = [
  { id: 'p1', name: 'Hamlet', description: 'Spring production', is_admin: true, inviteCode: 'AB23CDEF' },
  { id: 'p2', name: 'The Seagull', description: 'Studio reading', is_admin: false, inviteCode: null },
];

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/components', () => ({ SkeletonLoader: () => null }));
jest.mock('../../../../contexts/ProjectContext', () => ({
  useProjects: () => ({
    projects,
    selectedProject: projects[0],
    setSelectedProject: mockSetSelectedProject,
    loading: false,
    error: null,
  }),
}));

beforeEach(() => jest.clearAllMocks());

it('shows an admin’s card without its invite code, "Invite" or a tick', () => {
  const screen = render(<ProjectsScreen />);

  expect(screen.getByText('Hamlet')).toBeTruthy();
  expect(screen.getByText('Admin')).toBeTruthy();
  expect(screen.queryByText('AB23CDEF')).toBeNull();
  expect(screen.queryByText('Invite code')).toBeNull();
  expect(screen.queryByText('Invite')).toBeNull();
  expect(screen.queryByTestId('icon-Ionicons-checkmark-circle')).toBeNull();
});

it('opens a project and makes it the one the rehearsal form offers', () => {
  const screen = render(<ProjectsScreen />);

  fireEvent.press(screen.getByText('The Seagull'));

  expect(mockSetSelectedProject).toHaveBeenCalledWith(projects[1]);
  expect(mockNavigate).toHaveBeenCalledWith('ProjectDetail', { projectId: 'p2' });
});
