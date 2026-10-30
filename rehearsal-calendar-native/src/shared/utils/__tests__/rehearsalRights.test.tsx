/**
 * T-012: someone who is no admin anywhere had three ways into the rehearsal
 * form — "+ Add" in the planner, "Create Rehearsal" in the "+" sheet and a
 * long press on a day — and every one ended at "No projects where you are an
 * administrator". They are hidden from them, not dimmed (HIG, context menus).
 * The planner's "+ Add" is in SmartPlannerScreen.test.
 */
import React from 'react';
import { ActionSheetIOS } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { CreateActionSheet } from '../../components/CreateActionSheet';
import WeeklyCalendar from '../../../features/calendar/components/WeeklyCalendar';
import { canScheduleAny, canScheduleIn } from '../rehearsalRights';

jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../hooks/useClock', () => ({ useToday: () => '2030-01-10' }));
// The test mock of react-native has no action sheet; the one iOS shows.
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  ActionSheetIOS: { showActionSheetWithOptions: jest.fn() },
}));
jest.mock('../../../hooks/useWeekStart', () => ({
  ...jest.requireActual('../../../hooks/useWeekStart'),
  useWeekStart: () => 'monday',
}));

const project = (id: string, isAdmin: boolean) => ({ id, name: id, is_admin: isAdmin }) as any;

it('lets an admin of a project put a rehearsal in it, and nobody else', () => {
  expect(canScheduleIn(project('a', true))).toBe(true);
  expect(canScheduleIn(project('b', false))).toBe(false);
  expect(canScheduleIn(undefined)).toBe(false);
  expect(canScheduleAny([project('b', false), project('a', true)])).toBe(true);
  expect(canScheduleAny([project('b', false)])).toBe(false);
});

describe('The "+" sheet', () => {
  const show = ActionSheetIOS.showActionSheetWithOptions as jest.Mock;
  beforeEach(() => show.mockClear());

  const open = (onCreateRehearsal?: () => void) => {
    const actions = { onMarkBusy: jest.fn(), onCreateProject: jest.fn() };
    render(<CreateActionSheet visible onClose={jest.fn()} onCreateRehearsal={onCreateRehearsal} {...actions} />);
    const [[{ options }, choose]] = show.mock.calls;
    return { options, choose, ...actions };
  };

  it('lists "Create Rehearsal" for someone who can', () => {
    const create = jest.fn();
    const sheet = open(create);

    expect(sheet.options).toEqual(['Cancel', 'Create Rehearsal', 'Mark Busy', 'Create Project']);
    sheet.choose(1);
    expect(create).toHaveBeenCalled();
  });

  it('leaves it out for someone who cannot, and the rest still do what they say', () => {
    const sheet = open(undefined);

    expect(sheet.options).toEqual(['Cancel', 'Mark Busy', 'Create Project']);
    sheet.choose(1);
    expect(sheet.onMarkBusy).toHaveBeenCalled();
    sheet.choose(2);
    expect(sheet.onCreateProject).toHaveBeenCalled();
  });
});

describe('A long press on a day', () => {
  const strip = (onDayLongPress?: (date: string) => void) => render(
    <WeeklyCalendar rehearsals={[]} onDaySelect={jest.fn()} onShowToday={jest.fn()}
      onDayLongPress={onDayLongPress} selectedDate="2030-01-10" />
  ).getByTestId('calendar-day-2030-01-11');

  it('opens the form on that day for someone who can', () => {
    const press = jest.fn();
    fireEvent(strip(press), 'longPress');

    expect(press).toHaveBeenCalledWith('2030-01-11');
  });

  it('is no gesture at all for someone who cannot', () => {
    expect(strip(undefined).props.onLongPress).toBeUndefined();
  });
});
