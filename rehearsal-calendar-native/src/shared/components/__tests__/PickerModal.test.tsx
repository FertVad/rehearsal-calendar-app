/**
 * Cancel in a date or time picker leaves the value as it was (HC02).
 *
 * The spinner handed every turn straight to its owner, and Cancel and Done
 * both only closed the sheet — so Cancel kept the turned value, and with it
 * anything the owner did on a change: the rehearsal form moves the end two
 * hours past a later start. The owner is now told once, on Done.
 *
 * The owner below is handed both props, the old `onChange` and the new
 * `onConfirm`, so the same test reads the component before and after.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { PickerModal } from '../PickerModal';

let wheel: { value: Date; onChange: (event: { type: string }, date?: Date) => void } | null = null;
jest.mock('@react-native-community/datetimepicker', () => {
  return function DateTimePicker(props: any) {
    wheel = props;
    return null;
  };
});
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: { common: { cancel: 'Cancel', done: 'Done' } }, language: 'en' }),
}));

const NINE = new Date(2026, 9, 6, 9, 0);
const ELEVEN = new Date(2026, 9, 6, 11, 0);

function open(owner: jest.Mock, onClose = jest.fn(), value = NINE) {
  const props = { visible: true, value, onClose, mode: 'time' as const, title: 'Start', onConfirm: owner };
  // The component before this fix took onChange; it is passed too, to the same owner.
  const screen = render(<PickerModal {...props} {...({ onChange: owner } as object)} />);
  return { ...screen, props, onClose };
}

const turn = (date: Date) => act(() => wheel!.onChange({ type: 'set' }, date));

beforeEach(() => {
  wheel = null;
  (Platform as { OS: string }).OS = 'ios';
});

describe('On iOS', () => {
  it('Cancel after turning the wheel tells the owner nothing (HC02)', () => {
    const owner = jest.fn();
    const { getByText, onClose } = open(owner);

    turn(ELEVEN);
    fireEvent.press(getByText('Cancel'));

    expect(owner).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Done hands over the value the wheel was turned to, once', () => {
    const owner = jest.fn();
    const { getByText } = open(owner);

    turn(new Date(2026, 9, 6, 10, 0));
    turn(ELEVEN);
    fireEvent.press(getByText('Done'));

    expect(owner).toHaveBeenCalledTimes(1);
    expect(owner.mock.calls[0].find((arg: unknown) => arg instanceof Date)).toEqual(ELEVEN);
  });

  it('reopened, the wheel starts from the owner\'s value, not the abandoned turn', () => {
    const owner = jest.fn();
    const { getByText, rerender, props } = open(owner);

    turn(ELEVEN);
    fireEvent.press(getByText('Cancel'));
    rerender(<PickerModal {...props} visible={false} />);
    rerender(<PickerModal {...props} visible />);

    expect(wheel!.value).toEqual(NINE);
  });
});

describe('On Android, the native dialog answers once', () => {
  beforeEach(() => {
    (Platform as { OS: string }).OS = 'android';
  });

  it('"set" confirms the picked value and closes', () => {
    const owner = jest.fn();
    const { onClose } = open(owner);

    turn(ELEVEN);

    expect(owner.mock.calls[0].find((arg: unknown) => arg instanceof Date)).toEqual(ELEVEN);
    expect(onClose).toHaveBeenCalled();
  });

  it('"dismissed" only closes', () => {
    const owner = jest.fn();
    const { onClose } = open(owner);

    act(() => wheel!.onChange({ type: 'dismissed' }));

    expect(owner).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
