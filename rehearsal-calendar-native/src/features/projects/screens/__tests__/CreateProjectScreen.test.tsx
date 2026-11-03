/**
 * "Create" waits for a name, as "Sign in" waits for its fields (T-015): an
 * empty form was sent and answered with a "Name is required" alert (T-025).
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CreateProjectScreen from '../CreateProjectScreen';

const mockCreateProject = jest.fn();

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../contexts/ProjectContext', () => ({ useProjects: () => ({ createProject: mockCreateProject }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { timezone: 'UTC' } }) }));

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockCreateProject.mockResolvedValue({ id: 'p9' });
});

it('keeps "Create" off until the project has a name, and asks nothing', async () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const screen = render(<CreateProjectScreen navigation={navigation as any} route={{ key: 'c', name: 'CreateProject' } as any} />);
  const create = () => screen.getByLabelText('Create');

  expect(create().props.accessibilityState?.disabled ?? create().props.disabled).toBe(true);
  fireEvent.changeText(screen.getByPlaceholderText('Enter name'), '   ');
  expect(create().props.accessibilityState?.disabled ?? create().props.disabled).toBe(true);
  fireEvent.press(create());
  await settle();
  expect(mockCreateProject).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByPlaceholderText('Enter name'), 'Macbeth');
  expect(create().props.accessibilityState?.disabled ?? create().props.disabled).toBe(false);
  fireEvent.press(create());
  await settle();
  expect(mockCreateProject).toHaveBeenCalledWith(expect.anything(), 'Macbeth', undefined, 'UTC');
});
