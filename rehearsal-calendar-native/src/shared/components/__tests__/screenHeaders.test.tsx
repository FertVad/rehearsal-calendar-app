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
 * The planner kept its own "←" until the owner decided on it (04.11): it is
 * a tab's first screen, a large title and nothing to go back to (T-032).
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
  'features/smart-planner/screens/SmartPlannerScreen.tsx': 'root',
};

/** The sign-in and onboarding: forms with no bar. */
const OUTSIDE: string[] = [];

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

  /** The bar laid out: its left end `room` wide, the name and "Back" as wide as given. */
  const laidOut = (view: ReturnType<typeof render>, room: number, titleWidth: number, wordWidth: number) => {
    const layout = (id: string, width: number) => fireEvent(
      view.getByTestId(id, { includeHiddenElements: true }), 'layout',
      { nativeEvent: { layout: { x: 0, y: 0, width, height: 22 } } });
    layout('header-back-side', room);
    layout('header-back-measure-title', titleWidth);
    layout('header-back-measure-word', wordWidth);
  };

  it('a pushed screen: "‹" with the name of the one under it, then the title', () => {
    const onBack = jest.fn();
    const view = render(
      <ScreenHeader kind="stack" title="Estate Ball" backTitle="My Projects" backWord="Back" onBack={onBack} />,
    );
    laidOut(view, 143, 92, 38);
    const [back, title] = order(view, ['header-back', 'header-title']);
    expect(back).toBeGreaterThanOrEqual(0);
    expect(back).toBeLessThan(title);
    expect(view.getByText('My Projects')).toBeTruthy();
    expect(view.queryByTestId('header-cancel')).toBeNull();

    fireEvent.press(view.getByTestId('header-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // T-239: "‹ Проф…" beside the sync screen's title, "‹ My Pr…" beside
  // "Hamlet — Demo Theatre". As iOS's generic back button: the name where it
  // fits, else "Back", else the chevron alone — never a word cut short.
  describe('"‹" never cuts its word short', () => {
    const header = (room: number, titleWidth: number, wordWidth: number) => {
      const view = render(
        <ScreenHeader kind="stack" title="Hamlet — Demo Theatre" backTitle="My Projects" backWord="Back"
          onBack={jest.fn()} />,
      );
      laidOut(view, room, titleWidth, wordWidth);
      return view;
    };
    // The chevron, drawn 4 into the words, and 8 after them: 32 besides the words.
    // The icon's mock is a Text of its own, "Icon: chevron-back".
    const words = (view: ReturnType<typeof render>) =>
      view.getByTestId('header-back').findAll((node: { type: unknown }) => node.type === 'Text')
        .map((node: { props: { children?: unknown } }) => String(node.props.children))
        .filter((text: string) => !text.startsWith('Icon:'));

    it('the name of the screen under it, where it fits', () => {
      expect(words(header(92 + 32, 92, 38))).toEqual(['My Projects']);
    });

    it('"Back" where the name does not', () => {
      const view = header(94, 92, 38);
      expect(words(view)).toEqual(['Back']);
      expect(view.queryByText('My Projects')).toBeNull();
    });

    it('the chevron alone where neither does, still "Back" to VoiceOver', () => {
      const view = header(60, 92, 38);
      expect(words(view)).toEqual([]);
      expect(view.getByTestId('header-back').props.accessibilityLabel).toBe('Back');
    });

    it('the words being measured are out of the accessibility tree', () => {
      const view = header(200, 92, 38);
      expect(view.getAllByText('My Projects')).toHaveLength(1);
      expect(view.queryByText('Back')).toBeNull();
    });
  });

  it('a tab\'s first screen: a large title, nothing to go back to', () => {
    const root = render(<ScreenHeader kind="root" title="Calendar" />);
    const bar = render(<ScreenHeader kind="stack" title="Calendar Sync" backTitle="Profile" backWord="Back" onBack={jest.fn()} />);
    expect(root.queryByTestId('header-back')).toBeNull();
    expect(root.queryByTestId('header-cancel')).toBeNull();

    const size = (view: ReturnType<typeof render>, title: string) =>
      StyleSheet.flatten(view.getByText(title).props.style).fontSize;
    expect(size(root, 'Calendar')).toBe(34);
    expect(size(bar, 'Calendar Sync')).toBe(17);
  });
});
