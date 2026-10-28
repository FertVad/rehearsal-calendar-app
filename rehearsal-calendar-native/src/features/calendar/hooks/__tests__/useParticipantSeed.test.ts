/**
 * Who a new rehearsal starts with (DP02, review R9-01).
 *
 * The planner works out its times for the members picked in it, and the form
 * used to open with the whole project selected. The seed settles a project's
 * participants when they are not yet settled and its members are in: the
 * planner's people on the planner's project, everyone on any other. The form
 * decides when a project is unsettled — on arriving at it — so the seed keeps
 * no memory of its own (the screen tests drive the two together).
 */
import { renderHook } from '@testing-library/react-native';
import { useParticipantSeed, initialParticipants } from '../useParticipantSeed';

const TEN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

type Props = Parameters<typeof useParticipantSeed>[0];
function seed(props: Partial<Props>) {
  const startParticipants = jest.fn();
  const initial: Props = {
    isEditMode: false, projectId: 'p1', memberIds: TEN, membersReady: true, participantsSettled: false,
    plannedProjectId: undefined, plannedMemberIds: undefined, startParticipants, ...props,
  };
  const hook = renderHook((current: Props) => useParticipantSeed(current), { initialProps: initial });
  return { ...hook, initial, startParticipants };
}

describe('On the planner\'s project', () => {
  it('starts with the people the planner planned for, not the whole project (DP02)', () => {
    const { startParticipants } = seed({ plannedProjectId: 'p1', plannedMemberIds: ['3', '7'] });

    expect(startParticipants).toHaveBeenCalledWith('p1', ['3', '7']);
  });

  it('leaves out someone the planner had who is no longer in the project', () => {
    expect(initialParticipants(['3', '7'], ['3', '7', '99'])).toEqual(['3', '7']);
  });

  it('with nobody picked in the planner, starts with everyone, as the planner reads it', () => {
    const { startParticipants } = seed({ plannedProjectId: 'p1', plannedMemberIds: [] });

    expect(startParticipants).toHaveBeenCalledWith('p1', TEN);
  });
});

describe('On any other project', () => {
  it('starts with everyone', () => {
    const { startParticipants } = seed({ projectId: 'p2', plannedProjectId: 'p1', plannedMemberIds: ['3'] });

    expect(startParticipants).toHaveBeenCalledWith('p2', TEN);
  });
});

describe('When it does nothing', () => {
  it('while the project\'s members are not in, or failed to load', () => {
    const { startParticipants } = seed({ membersReady: false });

    expect(startParticipants).not.toHaveBeenCalled();
  });

  it('once the project\'s participants are settled — a cleared selection stays clear (R9-01)', () => {
    const { startParticipants } = seed({ participantsSettled: true });

    expect(startParticipants).not.toHaveBeenCalled();
  });

  it('on an edit, which keeps the rehearsal\'s own roster', () => {
    const { startParticipants } = seed({ isEditMode: true, plannedProjectId: 'p1', plannedMemberIds: ['3'] });

    expect(startParticipants).not.toHaveBeenCalled();
  });
});
