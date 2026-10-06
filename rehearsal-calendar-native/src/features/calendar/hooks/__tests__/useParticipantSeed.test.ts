/**
 * Who a new rehearsal starts with (DP02).
 *
 * The planner works out its times for the members picked in it, and the form
 * used to open with the whole project selected — the busy people the planner
 * had left out included. A rehearsal opened from the planner now starts with
 * the planner's people; one opened anywhere else, or switched to another
 * project, starts with everyone.
 */
import { renderHook } from '@testing-library/react-native';
import { useParticipantSeed, initialParticipants } from '../useParticipantSeed';

const TEN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

type Props = Parameters<typeof useParticipantSeed>[0];
function seed(props: Partial<Props>) {
  const setSelectedMemberIds = jest.fn();
  const initial: Props = {
    isEditMode: false, projectId: 'p1', memberIds: TEN, loading: false,
    plannedProjectId: undefined, plannedMemberIds: undefined, setSelectedMemberIds, ...props,
  };
  const hook = renderHook((current: Props) => useParticipantSeed(current), { initialProps: initial });
  return { ...hook, initial, setSelectedMemberIds };
}

describe('Opened from the planner', () => {
  it('starts with the people the planner planned for, not the whole project (DP02)', () => {
    const { setSelectedMemberIds } = seed({ plannedProjectId: 'p1', plannedMemberIds: ['3', '7'] });

    expect(setSelectedMemberIds).toHaveBeenCalledWith(['3', '7']);
  });

  it('leaves out someone the planner had who is no longer in the project', () => {
    expect(initialParticipants(['3', '7'], ['3', '7', '99'])).toEqual(['3', '7']);
  });

  it('with nobody picked in the planner, starts with everyone, as the planner reads it', () => {
    const { setSelectedMemberIds } = seed({ plannedProjectId: 'p1', plannedMemberIds: [] });

    expect(setSelectedMemberIds).toHaveBeenCalledWith(TEN);
  });

  it('switched to another project, starts that one with everyone', () => {
    const { setSelectedMemberIds, rerender, initial } = seed({ plannedProjectId: 'p1', plannedMemberIds: ['3'] });

    rerender({ ...initial, projectId: 'p2', memberIds: ['21', '22'] });

    expect(setSelectedMemberIds).toHaveBeenLastCalledWith(['21', '22']);
  });
});

describe('Opened anywhere else', () => {
  it('starts with everyone', () => {
    const { setSelectedMemberIds } = seed({});

    expect(setSelectedMemberIds).toHaveBeenCalledWith(TEN);
  });

  it('waits for the project\'s members, and seeds once — a cleared selection stays cleared', () => {
    const { setSelectedMemberIds, rerender, initial } = seed({ memberIds: [], loading: true });
    expect(setSelectedMemberIds).not.toHaveBeenCalled();

    rerender({ ...initial, memberIds: TEN, loading: false });
    rerender({ ...initial, memberIds: [...TEN], loading: false });

    expect(setSelectedMemberIds).toHaveBeenCalledTimes(1);
  });

  it('an edit keeps the rehearsal\'s own roster', () => {
    const { setSelectedMemberIds } = seed({ isEditMode: true, plannedProjectId: 'p1', plannedMemberIds: ['3'] });

    expect(setSelectedMemberIds).not.toHaveBeenCalled();
  });
});
