/**
 * The area around a sheet closes it; the sheet's own controls are its own
 * (see ModalSheet). The backdrop must not contain the sheet: wrapped inside a
 * touchable, the sheet reads as one button and a tap on it closes it.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, within } from '@testing-library/react-native';
import { ModalSheet } from '../ModalSheet';

jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../i18n/translations').translations.en, language: 'en' }),
}));

function sheet() {
  const onClose = jest.fn();
  const onPick = jest.fn();
  const screen = render(
    <ModalSheet onClose={onClose} overlayStyle={{ flex: 1 }}>
      <Text>Select Project</Text>
      <TouchableOpacity onPress={onPick}><Text>Hamlet</Text></TouchableOpacity>
    </ModalSheet>,
  );
  return { ...screen, onClose, onPick };
}

it('tapping around the sheet closes it', () => {
  const { getByLabelText, onClose } = sheet();

  fireEvent.press(getByLabelText('Close'));

  expect(onClose).toHaveBeenCalledTimes(1);
});

it('the sheet is not inside the closing area, so its controls are its own', () => {
  const { getByLabelText, getByText, onClose, onPick } = sheet();

  expect(within(getByLabelText('Close')).queryByText('Hamlet')).toBeNull();
  expect(within(getByLabelText('Close')).queryByText('Select Project')).toBeNull();

  fireEvent.press(getByText('Hamlet'));
  expect(onPick).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

it('the closing area says what it does', () => {
  const { getByLabelText } = sheet();

  expect(getByLabelText('Close').props.accessibilityRole).toBe('button');
});
