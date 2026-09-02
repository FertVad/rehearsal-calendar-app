/**
 * Editing a day.
 *
 * Both of these were found on a device rather than here, because the hook had
 * no tests at all and the defect was invisible until something else changed.
 *
 * Switching to "free" or "busy" used to leave a 10:00–18:00 placeholder in the
 * day's slots. Harmless while the slot list only appeared in custom mode — and
 * the moment a day could show custom hours for another reason (a phone-calendar
 * event on a day declared free), that placeholder appeared as a busy slot the
 * user had never entered.
 *
 * And adding hours to a day declared free had to make it a day of custom hours,
 * or the save — which reads the declared mode — would write the whole-day entry
 * and discard the new slot.
 */
import { Animated } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useAvailabilityEditor } from '../useAvailabilityEditor';
import { AvailabilityData, DayState } from '../../types';

// The hook animates the editor panel open on mount. Nothing here is about the
// animation, and the test renderer hands back no driver for it.
jest.spyOn(Animated, 'spring').mockReturnValue({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);

const DATE = '2026-09-08';

const setup = (initial: AvailabilityData = {}) => {
  let availability: AvailabilityData = { ...initial };

  const setAvailability = jest.fn((updater: (prev: AvailabilityData) => AvailabilityData) => {
    availability = updater(availability);
  });

  const getDayState = (date: string): DayState =>
    availability[date] || { mode: 'free', slots: [{ start: '10:00', end: '18:00' }] };

  const hook = renderHook(() =>
    useAvailabilityEditor({
      availability,
      setAvailability,
      setHasChanges: jest.fn(),
      getDayState,
      months: [{ year: 2026, month: 8, key: '2026-8' }],
    })
  );

  // Select the day, the way tapping it does.
  act(() => {
    hook.result.current.handleDayPress(2026, 8, 8, () => DATE);
  });

  return { hook, day: () => availability[DATE] };
};

describe('Choosing a mode', () => {
  it('leaves no slots behind when the day is marked free', () => {
    // The placeholder this replaced showed up as a 10:00–18:00 busy slot the
    // user never entered.
    const { hook, day } = setup({
      [DATE]: { mode: 'custom', slots: [{ start: '09:00', end: '11:00' }] },
    });

    act(() => hook.result.current.handleModeChange('free'));

    expect(day().mode).toBe('free');
    expect(day().slots).toEqual([]);
  });

  it('leaves no slots behind when the day is marked busy', () => {
    const { hook, day } = setup({
      [DATE]: { mode: 'custom', slots: [{ start: '09:00', end: '11:00' }] },
    });

    act(() => hook.result.current.handleModeChange('busy'));

    expect(day().slots).toEqual([]);
  });

  it('gives custom hours something to edit when there is nothing yet', () => {
    const { hook, day } = setup({ [DATE]: { mode: 'free', slots: [] } });

    act(() => hook.result.current.handleModeChange('custom'));

    expect(day().mode).toBe('custom');
    expect(day().slots).toHaveLength(1);
  });

  it('keeps the hours already entered when custom is chosen again', () => {
    const { hook, day } = setup({
      [DATE]: { mode: 'custom', slots: [{ start: '09:00', end: '11:00' }] },
    });

    act(() => hook.result.current.handleModeChange('custom'));

    expect(day().slots).toEqual([{ start: '09:00', end: '11:00' }]);
  });

  it('keeps the calendar events, whatever the mode', () => {
    const imported = [{ start: '19:00', end: '20:00', source: 'apple_calendar' as const }];
    const { hook, day } = setup({
      [DATE]: { mode: 'custom', slots: [], importedSlots: imported },
    });

    act(() => hook.result.current.handleModeChange('busy'));

    expect(day().importedSlots).toEqual(imported);
  });
});

describe('Adding hours', () => {
  it('turns a day declared free into a day of custom hours', () => {
    // Otherwise the save writes the all-day free entry and the new slot is
    // silently dropped. Reachable because a day can read as custom hours while
    // still declared free, when the phone's calendar has an event on it.
    const { hook, day } = setup({ [DATE]: { mode: 'free', slots: [] } });

    act(() => hook.result.current.addSlot());

    expect(day().mode).toBe('custom');
    expect(day().slots).toHaveLength(1);
  });

  it('appends to the hours already there', () => {
    const { hook, day } = setup({
      [DATE]: { mode: 'custom', slots: [{ start: '09:00', end: '11:00' }] },
    });

    act(() => hook.result.current.addSlot());

    expect(day().slots).toHaveLength(2);
    expect(day().slots[0]).toEqual({ start: '09:00', end: '11:00' });
  });

  it('removes the one asked for and leaves the rest', () => {
    const { hook, day } = setup({
      [DATE]: {
        mode: 'custom',
        slots: [
          { start: '09:00', end: '11:00' },
          { start: '14:00', end: '16:00' },
        ],
      },
    });

    act(() => hook.result.current.removeSlot(0));

    expect(day().slots).toEqual([{ start: '14:00', end: '16:00' }]);
  });
});
