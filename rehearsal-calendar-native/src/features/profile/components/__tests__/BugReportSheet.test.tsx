/**
 * A bug report that could not be sent says why, in the app's language (T-228).
 *
 * Its window said "Failed to send report" in English whatever the interface
 * spoke, and the same words whether the phone was offline or the server down.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import { BugReportSheet } from '../BugReportSheet';
import { bugReportsAPI } from '../../../../shared/services/api';

const t = jest.requireActual('../../../../i18n/translations').translations.ru;

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: jest.requireActual('../../../../i18n/translations').translations.ru, language: 'ru' }),
}));
jest.mock('../../../../shared/services/api', () => ({ bugReportsAPI: { create: jest.fn() } }));

const send = async () => {
  const sheet = render(<BugReportSheet visible onClose={jest.fn()} />);
  fireEvent.changeText(sheet.getByTestId('bug-report-message'), 'Календарь пустой');
  await act(async () => { fireEvent.press(sheet.getByTestId('bug-report-send')); });
};

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());

it.each([
  ['no answer', () => new AxiosError('Network Error', 'ERR_NETWORK', undefined, {}), t.common.noConnection],
  ['a 5xx', () => new AxiosError('Request failed with status code 502', 'ERR_BAD_RESPONSE', undefined, {},
    { status: 502, data: {}, statusText: '', headers: {}, config: {} as any }), t.common.serverUnavailable],
])('says why a report was not sent, in the app\'s language: %s', async (_what, failure, said) => {
  (bugReportsAPI.create as jest.Mock).mockRejectedValue(failure());

  await send();

  expect(alert).toHaveBeenCalledWith(t.common.error, said);
});

it('says it in its own words when no request was the trouble', async () => {
  (bugReportsAPI.create as jest.Mock).mockRejectedValue(new Error('boom'));

  await send();

  expect(alert).toHaveBeenCalledWith(t.common.error, t.profile.reportBugFailed);
  expect(t.profile.reportBugFailed).not.toBe('Failed to send report');
});
