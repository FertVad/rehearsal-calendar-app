/**
 * Both halves of openInTabs cost a round of debugging on a device, so both are
 * pinned here: it must clear whatever sits above the tabs, and it must still go
 * through `navigate`, because that is what carries `{ screen, params }` down
 * into a nested navigator. Doing only the first gave an endless stack of
 * modals; doing only the second landed on the calendar with no idea which
 * rehearsal to show.
 */
import { openInTabs } from '../openInTabs';

jest.mock('@react-navigation/native', () => ({
  StackActions: {
    popToTop: () => ({ type: 'POP_TO_TOP' }),
  },
}));

const makeNavigation = (index: number) => ({
  getState: () => ({ index, routes: [] }),
  dispatch: jest.fn(),
  navigate: jest.fn(),
});

const REHEARSAL = {
  screen: 'Calendar',
  params: { screen: 'CalendarMain', params: { openRehearsalId: '42' } },
};

describe('openInTabs', () => {
  it('clears the modal stacked above the tabs before navigating', () => {
    const navigation = makeNavigation(1);

    openInTabs(navigation, REHEARSAL);

    expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'POP_TO_TOP' });
  });

  it('does not dispatch a pop when the tabs are already bare', () => {
    const navigation = makeNavigation(0);

    openInTabs(navigation, REHEARSAL);

    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('navigates rather than only popping, so the nested params arrive', () => {
    const navigation = makeNavigation(1);

    openInTabs(navigation, REHEARSAL);

    expect(navigation.navigate).toHaveBeenCalledWith('MainTabs', REHEARSAL);
  });

  it('pops before it navigates, or navigate would push a second copy', () => {
    const order: string[] = [];
    const navigation = {
      getState: () => ({ index: 1, routes: [] }),
      dispatch: jest.fn(() => order.push('pop')),
      navigate: jest.fn(() => order.push('navigate')),
    };

    openInTabs(navigation, REHEARSAL);

    expect(order).toEqual(['pop', 'navigate']);
  });

  it('survives a navigation object with no getState', () => {
    const navigation = { dispatch: jest.fn(), navigate: jest.fn() };

    expect(() => openInTabs(navigation, REHEARSAL)).not.toThrow();
    expect(navigation.navigate).toHaveBeenCalled();
  });
});
