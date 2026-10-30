/**
 * Who takes part: one row, and a sheet to pick in (T-010).
 *
 * The form and the planner had a component each — a tick box whose label
 * said what a tap would do ("Clear" beside a tick), an "Expand" button and a
 * summary drawn like a button, open as a list inside the screen's scroll.
 * One component replaces both, and it says how things are.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, within } from '@testing-library/react-native';
import { ParticipantPicker, busyText, PickerPerson } from '../ParticipantPicker';
import { translations } from '../../../i18n/translations';

jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    language: 'en',
    t: jest.requireActual('../../../i18n/translations').translations.en,
  }),
}));

const t = translations.en;

const company = (n: number): PickerPerson[] =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i + 1}`, name: `Actor ${i + 1}` }));

const setup = (people: PickerPerson[], selectedIds: string[], extra: Partial<React.ComponentProps<typeof ParticipantPicker>> = {}) => {
  const onChange = jest.fn();
  const view = render(
    <ParticipantPicker people={people} selectedIds={selectedIds} onChange={onChange} {...extra} />
  );
  return { ...view, onChange };
};

const open = (view: ReturnType<typeof setup>) => fireEvent.press(view.getByTestId('participants-row'));

describe('the row', () => {
  it('is one line: the title and how many are picked', () => {
    const view = setup(company(4), ['m1', 'm2', 'm3', 'm4']);
    const row = view.getByTestId('participants-row');

    expect(row.props.accessibilityLabel).toBe('Participants, 4 of 4');
    expect(StyleSheet.flatten(row.props.style).minHeight).toBe(56);
    // No list, no buttons beside it, until it is tapped.
    expect(view.queryByText('Actor 1')).toBeNull();
    expect(view.queryByText(/Expand|Select All|Deselect All|Clear/)).toBeNull();
  });

  it('says who is busy on a second line', () => {
    const view = setup(company(2), ['m1', 'm2'], { conflict: 'Smirnov busy 10:00–14:00' });

    expect(view.getByTestId('participants-conflict').props.children).toBe('Smirnov busy 10:00–14:00');
    expect(view.getByTestId('participants-row').props.accessibilityLabel)
      .toBe('Participants, 2 of 2, Smirnov busy 10:00–14:00');
  });

  it('has no second line without a conflict', () => {
    const view = setup(company(2), ['m1']);

    expect(view.queryByTestId('participants-conflict')).toBeNull();
  });

  it('reads nobody as everyone where the screen says so (the planner)', () => {
    const view = setup(company(3), [], { noneLabel: 'All Members' });

    expect(view.getByTestId('participants-row').props.accessibilityLabel).toBe('Participants, All Members');
  });

  it('shows a selection that does not fit the roster as it is', () => {
    // A stale seed is a bug to see, not to hide (DP01).
    const view = setup(company(2), ['m1', 'm2', 'x']);

    expect(view.getByTestId('participants-row').props.accessibilityLabel).toBe('Participants, 3 of 2');
  });
});

describe('the sheet', () => {
  it('lists everyone, each a checkbox that says whether they are picked', () => {
    const view = setup(company(3), ['m2']);
    open(view);

    const first = view.getByTestId('participant-m1');
    const second = view.getByTestId('participant-m2');
    expect(first.props.accessibilityRole).toBe('checkbox');
    expect(first.props.accessibilityState).toEqual({ checked: false });
    expect(second.props.accessibilityState).toEqual({ checked: true });
    expect(StyleSheet.flatten(second.props.style).height).toBe(48);
  });

  it('picks and unpicks one person', () => {
    const view = setup(company(3), ['m2']);
    open(view);

    fireEvent.press(view.getByTestId('participant-m3'));
    expect(view.onChange).toHaveBeenLastCalledWith(['m2', 'm3']);
    fireEvent.press(view.getByTestId('participant-m2'));
    expect(view.onChange).toHaveBeenLastCalledWith([]);
  });

  it('marks some picked as mixed, and a tap then picks everyone', () => {
    const view = setup(company(3), ['m2']);
    open(view);
    const all = view.getByTestId('participants-all');

    expect(all.props.accessibilityRole).toBe('checkbox');
    expect(all.props.accessibilityState).toEqual({ checked: 'mixed' });
    expect(all.props.accessibilityLabel).toBe('All participants, 1 of 3');
    expect(StyleSheet.flatten(all.props.style).height).toBe(44);

    fireEvent.press(all);
    expect(view.onChange).toHaveBeenLastCalledWith(['m1', 'm2', 'm3']);
  });

  it('marks everyone picked as checked, and a tap then picks nobody', () => {
    const view = setup(company(3), ['m1', 'm2', 'm3']);
    open(view);
    const all = view.getByTestId('participants-all');

    expect(all.props.accessibilityState).toEqual({ checked: true });
    // The label is the state, never the action: no "Clear" beside a tick.
    expect(view.queryByText(/Clear|Deselect/)).toBeNull();
    fireEvent.press(all);
    expect(view.onChange).toHaveBeenLastCalledWith([]);
  });

  it('marks nobody picked as unchecked', () => {
    const view = setup(company(3), []);
    open(view);

    expect(view.getByTestId('participants-all').props.accessibilityState).toEqual({ checked: false });
  });

  it('names an admin in grey, and busy time only for someone busy', () => {
    const people = [
      { id: 'a', name: 'Olga Stage', isAdmin: true },
      { id: 'b', name: 'Grigory Smirnov', busy: '10:00–14:00' },
    ];
    const view = setup(people, ['a', 'b']);
    open(view);

    const olga = view.getByTestId('participant-a');
    const smirnov = view.getByTestId('participant-b');
    expect(within(olga).getByText(t.rehearsals.admin)).toBeTruthy();
    expect(olga.props.accessibilityLabel).toBe('Olga Stage, admin');
    expect(within(olga).queryByText(/\d\d:\d\d/)).toBeNull();
    expect(within(smirnov).getByText('10:00–14:00')).toBeTruthy();
    expect(smirnov.props.accessibilityLabel).toBe('Grigory Smirnov, 10:00–14:00');
  });

  it('has no search for twelve people', () => {
    const view = setup(company(12), []);
    open(view);

    expect(view.queryByTestId('participants-search')).toBeNull();
    expect(view.getByTestId('participant-m12')).toBeTruthy();
  });

  it('has a search for thirteen, which narrows the list by name', () => {
    const view = setup(company(13), []);
    open(view);

    fireEvent.changeText(view.getByTestId('participants-search'), 'actor 13');

    expect(view.getByTestId('participant-m13')).toBeTruthy();
    expect(view.queryByTestId('participant-m1')).toBeNull();
  });

  it('forgets the search once closed: the next project shows all of its people', () => {
    // A search in a company of thirteen, closed, then a project of two: the
    // query stayed and still filtered, with no field left to clear it, and
    // the sheet said "2 of 2" over no rows (T-010 review).
    const onChange = jest.fn();
    const view = render(<ParticipantPicker people={company(13)} selectedIds={[]} onChange={onChange} />);
    fireEvent.press(view.getByTestId('participants-row'));
    fireEvent.changeText(view.getByTestId('participants-search'), 'actor 13');
    fireEvent.press(view.getByTestId('participants-done'));

    const two = [{ id: 'p1', name: 'Prospero Milan' }, { id: 'p2', name: 'Ariel Spirit' }];
    view.rerender(<ParticipantPicker people={two} selectedIds={['p1', 'p2']} onChange={onChange} />);
    fireEvent.press(view.getByTestId('participants-row'));

    expect(view.getByTestId('participant-p1')).toBeTruthy();
    expect(view.getByTestId('participant-p2')).toBeTruthy();
  });

  it('narrows nothing where there is no field to see the search in', () => {
    // The roster shrinks under an open sheet to twelve or fewer.
    const onChange = jest.fn();
    const view = render(<ParticipantPicker people={company(13)} selectedIds={[]} onChange={onChange} />);
    fireEvent.press(view.getByTestId('participants-row'));
    fireEvent.changeText(view.getByTestId('participants-search'), 'actor 13');
    view.rerender(<ParticipantPicker people={company(2)} selectedIds={[]} onChange={onChange} />);

    expect(view.queryByTestId('participants-search')).toBeNull();
    expect(view.getByTestId('participant-m1')).toBeTruthy();
    expect(view.getByTestId('participant-m2')).toBeTruthy();
  });

  it('sits on the keyboard on iOS, so what the search found is above it', () => {
    const view = setup(company(13), []);
    open(view);

    const keyboard = view.getByTestId('participants-keyboard');
    expect(keyboard.props.behavior).toBe('padding');
    expect(within(keyboard).getByTestId('participants-search')).toBeTruthy();
    expect(within(keyboard).getByTestId('participant-m1')).toBeTruthy();
  });

  it('closes on Done', () => {
    const view = setup(company(2), []);
    open(view);
    fireEvent.press(view.getByTestId('participants-done'));

    // AppModal keeps it mounted while it slides away; on Android it is Modal.
    expect(view.getByTestId('participants-row')).toBeTruthy();
  });
});

describe('busy time beside a name', () => {
  it('is nothing for someone free, or only marked available', () => {
    expect(busyText(undefined, t)).toBeUndefined();
    expect(busyText([{ start: '10:00', end: '12:00', type: 'available' }], t)).toBeUndefined();
  });

  it('is the ranges', () => {
    expect(busyText([
      { start: '10:00', end: '12:00', type: 'busy' },
      { start: '14:00', end: '16:00', type: 'busy' },
    ], t)).toBe('10:00–12:00, 14:00–16:00');
  });

  it('is the whole day', () => {
    expect(busyText([{ start: '00:00', end: '23:59', type: 'busy' }], t)).toBe('all day');
  });
});

describe('every language', () => {
  it.each(['ru', 'en', 'es', 'de'] as const)('%s has every word of it', (lang) => {
    const r = translations[lang].rehearsals;
    expect(r.participantsCount(4, 4)).toMatch(/^4 \S+ 4$/);
    for (const word of [r.participants, r.allParticipants, r.searchParticipants, r.wholeDay, r.admin]) {
      expect(word).toBeTruthy();
    }
    expect(r.busyAt('Smirnov', '10:00–14:00')).toContain('10:00–14:00');
    expect(r.andMore(2)).toContain('2');
  });
});
