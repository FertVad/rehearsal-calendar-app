/**
 * A button that is only an icon takes a tap on 44×44 pt at least, says what it
 * does, and is a button (T-014; HIG: 44×44 pt on iOS).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { IconButton } from '../IconButton';
import { TouchTarget } from '../../constants/spacing';

/** Later entries win, as in React Native (the test mock's flatten does not). */
const flatten = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style as Record<string, unknown>) ?? {};

function target(style?: object) {
  const screen = render(<IconButton icon="close" accessibilityLabel="Close" onPress={() => {}} style={style} />);
  return flatten(screen.getByLabelText('Close').props.style);
}

it('is 44 pt a side at least', () => {
  expect(TouchTarget).toBe(44);
  const style = target();
  expect(style.minWidth).toBeGreaterThanOrEqual(44);
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
});

it('stays 44 whatever style it is given', () => {
  const style = target({ minWidth: 24, minHeight: 24, padding: 0 });
  expect(style.minWidth).toBeGreaterThanOrEqual(44);
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
});

it('can be larger, never smaller', () => {
  const larger = render(<IconButton icon="close" accessibilityLabel="Larger" minSize={47} onPress={() => {}} />);
  expect(flatten(larger.getByLabelText('Larger').props.style).minHeight).toBe(47);
  const smaller = render(<IconButton icon="close" accessibilityLabel="Smaller" minSize={30} onPress={() => {}} />);
  expect(flatten(smaller.getByLabelText('Smaller').props.style).minHeight).toBe(44);
});

it('is a button with a label', () => {
  const { getByLabelText } = render(<IconButton icon="trash-outline" accessibilityLabel="Delete" onPress={() => {}} />);
  expect(getByLabelText('Delete').props.accessibilityRole).toBe('button');
});

it('cannot be made without a label', () => {
  // @ts-expect-error accessibilityLabel is required
  render(<IconButton icon="close" onPress={() => {}} />);
});
