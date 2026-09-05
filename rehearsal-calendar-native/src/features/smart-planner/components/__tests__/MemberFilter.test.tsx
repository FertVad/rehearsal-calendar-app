/**
 * The member filter has to show every member.
 *
 * It used to be a FlatList with `scrollEnabled={false}` inside the screen's own
 * ScrollView — the usual way round a nested-scrolling conflict — under a style
 * capping it at 300pt. At roughly 48pt a row that is about six. The seventh
 * member and everyone after them were drawn past the end of the box and could
 * not be tapped, so they could never be included in or excluded from a plan.
 *
 * Reported from the device, by someone with a company larger than six. There
 * were no component tests here at all, which is why a list that showed six of
 * twelve people looked fine.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { MemberFilter } from '../MemberFilter';

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    language: 'ru',
    t: jest.requireActual('../../../../i18n/translations').ru,
  }),
}));

const company = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i + 1}`, name: `Актёр ${i + 1}` }));

const setup = (members: ReturnType<typeof company>, selected: string[] = []) => {
  const onSelectionChange = jest.fn();
  const view = render(
    <MemberFilter members={members} selected={selected} onSelectionChange={onSelectionChange} />
  );
  // The list is collapsed until asked for.
  fireEvent.press(view.getByText('Развернуть'));
  return { ...view, onSelectionChange };
};

describe('Every member is reachable', () => {
  it('draws all twelve of a twelve-person company', () => {
    const { getByText } = setup(company(12));

    expect(getByText('Актёр 12')).toBeTruthy();
  });

  it('lets the last one be selected, not just seen', () => {
    // Being rendered is not enough — the old list drew them and clipped them.
    const { getByText, onSelectionChange } = setup(company(12));

    fireEvent.press(getByText('Актёр 12'));

    expect(onSelectionChange).toHaveBeenCalledWith(['m12']);
  });

  it('still shows a company that fits', () => {
    const { getByText } = setup(company(3));

    expect(getByText('Актёр 3')).toBeTruthy();
  });
});

describe('Nothing caps the list', () => {
  // The tests above pass against the broken version too: the test renderer has
  // no layout, so a maxHeight clips nothing and a FlatList renders every row.
  // A height cap is invisible to it. So this one checks the constraint itself
  // rather than its effect — weaker, and the only kind that would have caught
  // the original.
  it('gives the list no height limit to be clipped by', () => {
    const { getByTestId } = setup(company(12));

    const style = StyleSheet.flatten(getByTestId('member-list').props.style) || {};
    expect(style.maxHeight).toBeUndefined();
    expect(style.height).toBeUndefined();
  });

  it('does not scroll on its own, because the screen does', () => {
    // A list that scrolls inside the screen's ScrollView fights it for the
    // gesture. Capping its height was the workaround that broke this.
    const { getByTestId } = setup(company(12));

    expect(getByTestId('member-list').props.scrollEnabled).toBeUndefined();
  });
});

describe('Selecting everyone', () => {
  it('selects every member, however many there are', () => {
    const { getByText, onSelectionChange } = setup(company(9));

    fireEvent.press(getByText('Выбрать всех'));

    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(['m1', 'm9'])
    );
    expect(onSelectionChange.mock.calls[0][0]).toHaveLength(9);
  });

  it('clears the selection when everyone is already selected', () => {
    const all = company(4).map((m) => m.id);
    const { getByText, onSelectionChange } = setup(company(4), all);

    fireEvent.press(getByText('Выбрать всех'));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});
