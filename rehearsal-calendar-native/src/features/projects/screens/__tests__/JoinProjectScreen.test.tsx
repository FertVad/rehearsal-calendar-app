/**
 * A code typed by hand that the server does not know (T-011). The screen went
 * to a full-screen error whose one button, "Try another code", was drawn black
 * on the dark background: nothing visible to tap, no way back. The error now
 * sits under the field, and the code stays in it to be corrected.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { invitesAPI } from '../../../../shared/services/api';
import { Colors } from '../../../../shared/constants/colors';
import JoinProjectScreen from '../JoinProjectScreen';

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../contexts/ProjectContext', () => ({ useProjects: () => ({ refreshProjects: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../shared/services/api', () => ({
  invitesAPI: { getInviteInfo: jest.fn(), joinProject: jest.fn() },
}));

const notFound = () => Object.assign(new Error('404'), { response: { status: 404 } });
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const navigation = () => ({ goBack: jest.fn(), reset: jest.fn() } as any);

beforeEach(() => jest.clearAllMocks());

it('shows a wrong code’s error under the field and keeps the code typed', async () => {
  (invitesAPI.getInviteInfo as jest.Mock).mockRejectedValue(notFound());
  const screen = render(
    <JoinProjectScreen route={{ key: 'j', name: 'JoinProject', params: {} } as any} navigation={navigation()} />
  );

  fireEvent.changeText(screen.getByTestId('join-code-input'), 'WRONG42');
  fireEvent.press(screen.getByTestId('join-code-submit'));
  await settle();

  expect(invitesAPI.getInviteInfo).toHaveBeenCalledWith('WRONG42');
  expect(screen.getByTestId('join-code-error')).toHaveTextContent('Invitation not found');
  expect(screen.getByTestId('join-code-input').props.value).toBe('WRONG42');

  // The same code sent again is asked again, not ignored as unchanged.
  (invitesAPI.getInviteInfo as jest.Mock).mockResolvedValue({ data: { projectId: 'p1', projectName: 'Hamlet' } });
  fireEvent.press(screen.getByTestId('join-code-submit'));
  await settle();
  expect(invitesAPI.getInviteInfo).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('join-project-name')).toHaveTextContent('Hamlet');
});

it('draws the button of a link’s error as a button: visible on the dark background', async () => {
  (invitesAPI.getInviteInfo as jest.Mock).mockRejectedValue(notFound());
  const nav = navigation();
  const screen = render(
    <JoinProjectScreen route={{ key: 'j', name: 'JoinProject', params: { code: 'GONE1' } } as any} navigation={nav} />
  );
  await settle();
  await settle();

  const label = screen.getByText('Close');
  const style = Object.assign({}, ...[label.props.style].flat(Infinity).filter(Boolean));
  expect(style.color).toBe(Colors.text.inverse);
  fireEvent.press(label);
  expect(nav.goBack).toHaveBeenCalled();
});
