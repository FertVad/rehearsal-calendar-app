/**
 * A short notice: shown for two seconds, a second one starting the two over,
 * over the bottom action bar and taking no taps (T-021).
 */
import React from 'react';
import { act, render, renderHook } from '@testing-library/react-native';
import { Toast, useToast, TOAST_DURATION_MS } from '../Toast';
import { BOTTOM_ACTION_GAP, BOTTOM_ACTION_HEIGHT } from '../BottomActionBar';
import { Spacing } from '../../constants/colors';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('shows a message for two seconds', () => {
  const { result } = renderHook(() => useToast());
  expect(result.current.message).toBeNull();

  act(() => result.current.show('Saved'));
  expect(TOAST_DURATION_MS).toBe(2000);
  act(() => { jest.advanceTimersByTime(1999); });
  expect(result.current.message).toBe('Saved');
  act(() => { jest.advanceTimersByTime(1); });
  expect(result.current.message).toBeNull();
});

it('a second message gets its own two seconds', () => {
  const { result } = renderHook(() => useToast());

  act(() => result.current.show('Saved'));
  act(() => { jest.advanceTimersByTime(1500); });
  act(() => result.current.show('Saved again'));
  act(() => { jest.advanceTimersByTime(1500); });
  expect(result.current.message).toBe('Saved again');
  act(() => { jest.advanceTimersByTime(500); });
  expect(result.current.message).toBeNull();
});

it('sits above the bottom action bar, takes no taps, and is not there without a message', () => {
  const screen = render(<Toast message="Saved" />);
  const text = screen.getByTestId('toast');
  expect(text.props.children).toBe('Saved');

  let wrap = text.parent;
  while (wrap && wrap.props.pointerEvents === undefined) wrap = wrap.parent;
  expect(wrap!.props.pointerEvents).toBe('none');
  const style = Object.assign({}, ...[wrap!.props.style].flat());
  expect(style.bottom).toBe(34 + BOTTOM_ACTION_GAP + BOTTOM_ACTION_HEIGHT + Spacing.sm + Spacing.md);

  expect(render(<Toast message={null} />).queryByTestId('toast')).toBeNull();
});
