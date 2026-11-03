/**
 * Screen headers: one style (T-029).
 *
 * Each screen drew its own bar, and they came out four ways — a large title
 * with a cross on the right, a smaller title between a chevron and an empty
 * box, a large title after an arrow, a large title alone — with the way out a
 * cross, a chevron or an arrow, on either side. Now every screen of the app
 * takes its bar from ScreenHeader, by its kind: a sheet has Cancel on the
 * left, a screen pushed in a tab has "‹" with the name of the one under it,
 * the first screen of a tab has a large title.
 *
 * The planner's own "←" is left as it is: the owner has not decided on it.
 */
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ScreenHeader } from '../ScreenHeader';

const SRC = join(__dirname, '..', '..', '..');

/** Every screen of the app and the kind of bar it has. */
const SCREENS: Record<string, 'modal' | 'stack' | 'root'> = {
  'features/calendar/screens/AddRehearsalScreen.tsx': 'modal',
  'features/calendar/screens/RehearsalDetailsScreen.tsx': 'modal',
  'features/projects/screens/CreateProjectScreen.tsx': 'modal',
  'features/projects/screens/JoinProjectScreen.tsx': 'modal',
  'features/availability/screens/AvailabilityScreen.tsx': 'modal',
  'features/notifications/screens/NotificationsScreen.tsx': 'modal',
  'features/profile/screens/EditProfileScreen.tsx': 'modal',
  'features/profile/screens/ChangeEmailScreen.tsx': 'modal',
  'features/projects/screens/ProjectDetailScreen.tsx': 'stack',
  'features/profile/screens/CalendarSyncSettingsScreen.tsx': 'stack',
  'features/calendar/screens/CalendarScreen.tsx': 'root',
  'features/projects/screens/ProjectsScreen.tsx': 'root',
  'features/profile/screens/ProfileScreen.tsx': 'root',
};

/** Not this task's: the planner (its "←" waits for the owner), and the
 *  sign-in and onboarding, which are forms with no bar. */
const OUTSIDE = [
  'features/smart-planner/screens/SmartPlannerScreen.tsx',
  'features/smart-planner/screens/SmartPlannerTabScreen.tsx',
];

function screens(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : screens(full);
    return /\/screens\/[^/]+\.tsx$/.test(full) ? [full] : [];
  });
}

const appScreens = () => screens(join(SRC, 'features'))
  .map((file) => relative(SRC, file))
  .filter((file) => !/^features\/(auth|onboarding)\//.test(file) && !OUTSIDE.includes(file));

describe('every screen takes its bar from ScreenHeader', () => {
  it('each screen of the app is of one kind', () => {
    expect(appScreens().sort()).toEqual(Object.keys(SCREENS).sort());
  });

  it.each(Object.entries(SCREENS))('%s: %s', (file, kind) => {
    const text = readFileSync(join(SRC, file), 'utf8');
    const kinds = [...text.matchAll(/<ScreenHeader\b[^>]*?kind="(\w+)"/g)].map((match) => match[1]);
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set([kind]));
  });

  it('no screen draws its own back arrow or chevron', () => {
    const own = appScreens().filter((file) =>
      /icon="(arrow-back|chevron-back)"/.test(readFileSync(join(SRC, file), 'utf8')));
    expect(own).toEqual([]);
  });
});

describe('ScreenHeader', () => {
  const order = (view: ReturnType<typeof render>, ids: string[]) => {
    const json = JSON.stringify(view.toJSON());
    return ids.map((id) => json.indexOf(`"testID":"${id}"`));
  };

  it('a sheet: Cancel, then the title, then the action', () => {
    const onCancel = jest.fn();
    const view = render(
      <ScreenHeader kind="modal" title="Create Project" cancelLabel="Cancel" onCancel={onCancel}
        right={<Text testID="action">Save</Text>} />,
    );
    const [cancel, title, action] = order(view, ['header-cancel', 'header-title', 'action']);
    expect(cancel).toBeGreaterThanOrEqual(0);
    expect(cancel).toBeLessThan(title);
    expect(title).toBeLessThan(action);
    expect(view.getByText('Cancel')).toBeTruthy();
    expect(view.queryByTestId('header-back')).toBeNull();

    fireEvent.press(view.getByTestId('header-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('a sheet with nothing to go back to has no Cancel', () => {
    const view = render(<ScreenHeader kind="modal" title="Busy" cancelLabel="Cancel" />);
    expect(view.queryByTestId('header-cancel')).toBeNull();
  });

  it('a pushed screen: "‹" with the name of the one under it, then the title', () => {
    const onBack = jest.fn();
    const view = render(
      <ScreenHeader kind="stack" title="Estate Ball" backTitle="My Projects" onBack={onBack} />,
    );
    const [back, title] = order(view, ['header-back', 'header-title']);
    expect(back).toBeGreaterThanOrEqual(0);
    expect(back).toBeLessThan(title);
    expect(view.getByText('My Projects')).toBeTruthy();
    expect(view.queryByTestId('header-cancel')).toBeNull();

    fireEvent.press(view.getByTestId('header-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('a tab\'s first screen: a large title, nothing to go back to', () => {
    const root = render(<ScreenHeader kind="root" title="Calendar" />);
    const bar = render(<ScreenHeader kind="stack" title="Calendar Sync" backTitle="Profile" onBack={jest.fn()} />);
    expect(root.queryByTestId('header-back')).toBeNull();
    expect(root.queryByTestId('header-cancel')).toBeNull();

    const size = (view: ReturnType<typeof render>, title: string) =>
      StyleSheet.flatten(view.getByText(title).props.style).fontSize;
    expect(size(root, 'Calendar')).toBe(34);
    expect(size(bar, 'Calendar Sync')).toBe(17);
  });
});
