/**
 * A rehearsal as a row of 88 pt with a date column (T-036, owner's choice B
 * of 04.11, audit 29.10 s04-1). It was a card of 203 pt: a date badge, an
 * "Admin" badge, an icon to each line, the eye on a strip of its own.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../../../contexts/SeenContext', () => ({
  useSeen: () => ({
    responseFor: (id: string) => (id === 'a1' ? 'yes' : null),
    statsFor: (id: string) => (id === 'a1' ? { confirmed: 2, invited: 3 } : undefined),
    isResponding: () => false,
    toggleSeen: jest.fn(),
    prime: jest.fn(),
  }),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: {
      common: { today: 'Today', delete: 'Delete' },
      rehearsals: { markSeen: 'Mark as seen', edit: 'Edit' },
      calendar: { tomorrow: 'Tomorrow' },
      projects: { admin: 'Admin' },
    },
    language: 'en',
  }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-native-gesture-handler/Swipeable', () => {
  const { View } = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  return R.forwardRef(({ children }: any, _ref: any) => R.createElement(View, null, children));
});
jest.mock('react-native-gesture-handler', () => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  return { TouchableOpacity };
});
jest.mock('../../hooks/useDeleteRehearsal', () => ({ useDeleteRehearsal: () => jest.fn() }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Medium: 'medium' } }));
// The 24-hour clock, so the times read the same on any machine.
jest.mock('../../../../shared/utils/clockFormat', () => ({
  ...jest.requireActual('../../../../shared/utils/clockFormat'),
  usePhoneUses24HourClock: () => true,
}));

import RehearsalList from '../RehearsalList';
import { Project, Rehearsal } from '../../../../shared/types';
import { Colors } from '../../../../shared/constants/colors';
import { projectColor } from '../../../../shared/utils/projectColor';

const projects: Project[] = [
  { id: '7', chat_id: 'c7', name: 'Arden', timezone: 'UTC', is_admin: true, created_at: '2025-01-01' },
  { id: '8', chat_id: 'c8', name: 'Court', timezone: 'UTC', is_admin: false, created_at: '2025-01-01' },
];

const at = (id: string, date: string, from: string, to: string, extra: Partial<Rehearsal> = {}): Rehearsal => ({
  id,
  projectId: '7',
  startsAt: `${date}T${from}:00Z`,
  endsAt: `${date}T${to}:00Z`,
  date,
  time: `${from}:00`,
  endTime: `${to}:00`,
  ...extra,
});

// Thursday 29 and Friday 30 October 2026: two on the first, one on the second.
const upcoming: Rehearsal[] = [
  at('a1', '2026-10-29', '12:00', '13:00', { title: 'Wrestling match', location: 'Main hall' }),
  at('a2', '2026-10-29', '15:00', '16:00', { title: 'Epilogue', projectId: '8' }),
  at('a3', '2026-10-30', '10:00', '11:00', { location: 'Glade' }),
];

const list = (rehearsals = upcoming, withDates = true, synced?: Record<string, boolean>) => render(
  <RehearsalList
    rehearsals={rehearsals}
    projects={projects}
    withDates={withDates}
    synced={synced}
    onOpenRehearsal={jest.fn()}
  />,
);

// The mock's StyleSheet.flatten hands the style back as it is.
const flat = (s: any): Record<string, any> =>
  Array.isArray(s) ? Object.assign({}, ...s.map(flat)) : s || {};
const style = (node: any) => flat(node.props.style);
// The count under the eye is hidden from VoiceOver, which hears it as the
// button's value; the queries skip hidden elements unless asked.
const hidden = { includeHiddenElements: true };

describe('the date column', () => {
  it('names the day on the first rehearsal of a day only', () => {
    const { getAllByTestId } = list();
    const columns = getAllByTestId('rehearsal-row-date');
    // Every row keeps its width, so the texts line up.
    expect(columns).toHaveLength(3);
    expect(columns.map((column) => style(column).width)).toEqual([52, 52, 52]);

    const texts = (column: any) =>
      column.findAll((n: any) => typeof n.props.children === 'string' || typeof n.props.children === 'number', { deep: true })
        .filter((n: any) => n.type === 'Text')
        .map((n: any) => String(n.props.children));
    expect(texts(columns[0])).toEqual(['Thu', '29']);
    expect(texts(columns[1])).toEqual([]);
    expect(texts(columns[2])).toEqual(['Fri', '30']);
  });

  it('writes the day of the week small, in capitals, and the day large and bold', () => {
    const { getByText } = list();
    expect(style(getByText('Thu'))).toMatchObject({
      fontSize: 12, textTransform: 'uppercase', color: Colors.text.secondary,
    });
    expect(style(getByText('29'))).toMatchObject({ fontSize: 22, fontWeight: '700' });
  });

  it('is not drawn in a day’s own list', () => {
    const { queryAllByTestId } = list(upcoming.slice(0, 2), false);
    expect(queryAllByTestId('rehearsal-row-date')).toHaveLength(0);
  });
});

describe('the row', () => {
  it('is 88 pt, its eye 44 a side', () => {
    const { getAllByTestId, UNSAFE_root } = list();
    const rows = UNSAFE_root.findAll((n: any) => n.type === 'View' && style(n)?.minHeight === 88);
    expect(rows).toHaveLength(3);
    for (const eye of getAllByTestId('seen-toggle')) {
      expect(style(eye)).toMatchObject({ width: 44, height: 44 });
    }
  });

  it('is the title, then the time and the place, then the project', () => {
    const { getByText, getAllByText } = list();
    expect(style(getByText('Wrestling match'))).toMatchObject({ fontSize: 17, fontWeight: '600' });
    expect(getByText('Wrestling match').props.numberOfLines).toBe(1);
    expect(style(getByText('12:00–13:00'))).toMatchObject({ fontSize: 15, color: Colors.text.secondary });
    expect(style(getByText(' · Main hall'))).toMatchObject({ fontSize: 15, color: Colors.text.secondary });
    expect(style(getAllByText('Arden')[0])).toMatchObject({ fontSize: 13, color: Colors.text.secondary });
  });

  it('has no title line without a title, and the time alone without a place', () => {
    const untitled = list([upcoming[2]]);
    expect(untitled.UNSAFE_root.findAll((n: any) => n.type === 'Text' && style(n)?.fontSize === 17)).toHaveLength(0);
    expect(untitled.getByTestId('rehearsal-card-time').props.children).toBe('10:00–11:00');
    expect(untitled.getByText(' · Glade')).toBeTruthy();

    const placeless = list([upcoming[1]]);
    expect(placeless.getByTestId('rehearsal-card-time').props.children).toBe('15:00–16:00');
    expect(placeless.queryByText(/ · /)).toBeNull();
  });

  it('dots each project in its own colour, the one projectColor gives it', () => {
    const { getAllByTestId } = list();
    const dots = getAllByTestId('rehearsal-project-dot').map((dot) => style(dot));
    expect(dots.map((dot) => dot.backgroundColor)).toEqual([projectColor('7'), projectColor('8'), projectColor('7')]);
    expect(dots[0]).toMatchObject({ width: 8, height: 8 });
    expect(projectColor('7')).not.toBe(projectColor('8'));
  });

  it('has no badges and no icons but the eye', () => {
    const { queryByText, queryAllByTestId } = list();
    expect(queryByText('Admin')).toBeNull();
    expect(queryByText('Today')).toBeNull();
    expect(queryByText('Tomorrow')).toBeNull();
    for (const icon of ['time-outline', 'folder-outline', 'location-outline', 'shield-checkmark']) {
      expect(queryAllByTestId(`icon-Ionicons-${icon}`)).toHaveLength(0);
    }
  });

  it('shows the phone’s calendar small after the time, in the second line’s colour', () => {
    const { UNSAFE_getAllByType } = list([upcoming[0]], true, { a1: true });
    const icon = UNSAFE_getAllByType(require('@expo/vector-icons').Ionicons)
      .find((i: any) => i.props.name === 'calendar');
    expect(icon?.props.color).toBe(Colors.text.secondary);
    expect(icon?.props.size).toBeLessThanOrEqual(15);
  });

  it('counts under the eye, 12 pt, the button saying it as before', () => {
    const { getByText, getAllByTestId } = list([upcoming[0]]);
    expect(style(getByText('2/3', hidden))).toMatchObject({ fontSize: 12 });
    const eye = getAllByTestId('seen-toggle')[0];
    expect(eye.props.accessibilityValue).toEqual({ text: '2/3' });
    // Not inside the 44: the eye's box stays a square.
    expect(eye.findAll((n: any) => n.props.children === '2/3')).toHaveLength(0);
  });
});

describe('the lines between rows', () => {
  it('are inset to the text within a day and across the ground between days', () => {
    const { getAllByTestId } = list();
    const within = getAllByTestId('rehearsal-separator-day');
    const between = getAllByTestId('rehearsal-separator-days');
    expect(within).toHaveLength(1);
    expect(between).toHaveLength(1);
    expect(style(within[0]).marginLeft).toBe(64);
    expect(style(between[0]).marginLeft).toBeUndefined();
  });

  it('put the rows on one rounded ground', () => {
    const { toJSON } = list();
    expect(flat((toJSON() as any).props.style)).toMatchObject({
      backgroundColor: Colors.bg.secondary, borderRadius: 12,
    });
  });
});
