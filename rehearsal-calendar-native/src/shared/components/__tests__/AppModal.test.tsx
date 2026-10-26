/**
 * On iOS a sheet is shown in the window, not presented: React Native's Modal
 * left the second sheet a screen presented out of the accessibility tree
 * (T-208, AppModal). Flow 26 shows it on the simulator; this shows which way
 * each platform takes.
 */
import React from 'react';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AppModal } from '../AppModal';

const sheet = (visible: boolean) => (
  <AppModal visible={visible} onRequestClose={jest.fn()}>
    <Text>Select End Time</Text>
  </AppModal>
);

type Node = { findAll: (match: (node: { type: unknown }) => boolean) => unknown[] };
const count = (root: Node, type: string) => root.findAll((node) => node.type === type).length;

afterEach(() => {
  (Platform as { OS: string }).OS = 'ios';
});

it('on iOS shows the sheet in a full-window overlay, not in a Modal', () => {
  const { UNSAFE_root, getByText } = render(sheet(true));

  expect(getByText('Select End Time')).toBeTruthy();
  expect(count(UNSAFE_root, 'FullWindowOverlay')).toBe(1);
  expect(count(UNSAFE_root, 'Modal')).toBe(0);
});

it('on iOS shows it again after it closed', () => {
  const screen = render(sheet(true));
  screen.rerender(sheet(false));
  expect(screen.queryByText('Select End Time')).toBeNull();

  screen.rerender(sheet(true));

  expect(screen.getByText('Select End Time')).toBeTruthy();
});

it('on Android keeps the Modal, for the back button', () => {
  (Platform as { OS: string }).OS = 'android';

  const { UNSAFE_root } = render(sheet(true));

  expect(count(UNSAFE_root, 'Modal')).toBe(1);
});
