/**
 * White text on the app's purple is read at 4.5:1 at least — Apple's floor for
 * text under 17 pt (HIG, Accessibility), the WCAG AA ratio. White on #A855F7
 * is 3.96:1; on #9333EA, 5.38:1 (owner, 02.11, T-027). The main buttons and
 * everything else with white text on purple take their fill from one token,
 * flat: a gradient from #A855F7 put the start of the label below the floor.
 * Purple in icons, labels, borders and selection stays #A855F7.
 */
import React from 'react';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { render } from '@testing-library/react-native';
import { Colors } from '../colors';
import { BottomActionButton } from '../../components/BottomActionBar';
import GlassButton from '../../components/buttons/GlassButton';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));

/** WCAG 2.x relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Later entries win, as in React Native (the test mock's flatten does not). */
const flatten = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style as Record<string, unknown>) ?? {};

it('the formula gives the ratios the decision was taken on', () => {
  expect(contrast('#ffffff', '#A855F7')).toBeCloseTo(3.96, 2);
  expect(contrast('#ffffff', '#9333EA')).toBeCloseTo(5.38, 2);
});

it('white on the fill is 4.5:1 at least', () => {
  expect(Colors.accent.purpleFill).toMatch(/^#[0-9a-f]{6}$/i);
  expect(contrast(Colors.text.inverse, Colors.accent.purpleFill)).toBeGreaterThanOrEqual(4.5);
});

it("the bottom bar's main button is filled with it", () => {
  const { getByTestId } = render(<BottomActionButton testID="main" label="Create" onPress={() => {}} />);
  expect(flatten(getByTestId('main').props.style).backgroundColor).toBe(Colors.accent.purpleFill);
});

it('the purple GlassButton is filled with it, flat', () => {
  const { getByTestId, UNSAFE_root } = render(
    <GlassButton testID="sign-in" variant="purple" title="Sign in" onPress={() => {}} />,
  );
  // No gradient anywhere inside it: nothing under the label but the fill.
  const gradients = UNSAFE_root.findAll(({ type, props }: { type: unknown; props: { colors?: unknown } }) =>
    typeof type !== 'string' && props.colors !== undefined);
  expect(gradients.map((node: { props: { colors?: unknown } }) => node.props.colors)).toEqual([]);
  expect(flatten(getByTestId('sign-in').props.style).backgroundColor).toBe(Colors.accent.purpleFill);
});

// A style block filled with the light purple — everything else on it is white
// text. These carry no text: a selected day or checkbox, a dot, an icon.
const SRC = join(__dirname, '..', '..', '..');
const NO_TEXT_ON_IT = new Set([
  'features/calendar/components/WeeklyCalendar.tsx daySelected',
  'shared/components/ParticipantPicker.tsx boxOn',
  'features/onboarding/components/OnboardingProgress.tsx dotActive',
  'features/notifications/styles/notificationsScreenStyles.ts unreadDot',
  'features/calendar/styles/calendarScreenStyles.ts smartPlannerIconContainer',
]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

it('nothing with white text on it is filled with #A855F7', () => {
  const found = sources(SRC).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/^ {2}(\w+): \{\n((?: {4}.*\n)*?) {2}\},?$/gm)]
      .filter(([, , body]) => /backgroundColor: Colors\.accent\.purple,/.test(body))
      .map(([, name]) => `${relative(SRC, file)} ${name}`)
      .filter((block) => !NO_TEXT_ON_IT.has(block));
  });
  const gradients = sources(SRC)
    .filter((file) => /colors=\{\[Colors\.accent\.purple,/.test(readFileSync(file, 'utf8')))
    .map((file) => `${relative(SRC, file)} gradient`);
  // A react-native-calendars day marking: the library fills the day with its
  // `color` and writes its `textColor` on it, whatever the theme's
  // selected-day colours (T-031 review: the theme was changed, the days not).
  const markings = sources(SRC).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(
      /\bcolor: Colors\.accent\.purple,\s*\n\s*textColor: ('white'|'#fff(fff)?'|Colors\.text\.inverse)/gi,
    )].map(() => `${relative(SRC, file)} marking`));
  expect([...found, ...gradients, ...markings]).toEqual([]);
});
