/**
 * What the planner is allowed to call busy.
 *
 * This function used to take the project's rehearsals as a third argument and
 * push each one's time range onto every member, on the assumption that the whole
 * company attends everything. Once rehearsals got their own rosters that became
 * false, and the planner started refusing times that were genuinely free.
 *
 * It was invisible in testing for a long time because it only shows when a
 * rehearsal has a partial roster: when everyone is on it, the invented range and
 * the real one are the same interval and merge into one. So the property worth
 * pinning is not "busy hours survive" but "no hours are invented" — the merger
 * may only ever repeat what the server said about that member.
 */
import { mergeMemberAvailability, type MemberAvailability } from '../availabilityMerger';
import type { Member } from '../../types';

const members: Member[] = [
  { id: '1', name: 'Аня' },
  { id: '2', name: 'Борис' },
];

const DATE = '2026-12-01';

const busyOn = (rows: ReturnType<typeof mergeMemberAvailability>, memberId: string) =>
  rows.find((r) => r.memberId === memberId && r.date === DATE)?.busyRanges ?? [];

// One source='rehearsal' busy row, as the members-availability endpoint sends it
// for a participant. Non-participants get nothing for that date.
const rehearsalRow = { start: '14:00', end: '16:00', type: 'busy' } as any;

describe('mergeMemberAvailability', () => {
  it('marks a participant busy for the rehearsal hours the server sent', () => {
    const avail: MemberAvailability[] = [
      { userId: '1', firstName: 'Аня', dates: [{ date: DATE, timeRanges: [rehearsalRow] }] },
      { userId: '2', firstName: 'Борис', dates: [] },
    ];

    expect(busyOn(mergeMemberAvailability(members, avail), '1')).toEqual([
      { start: '14:00', end: '16:00' },
    ]);
  });

  it('leaves someone who is not on that rehearsal free', () => {
    const avail: MemberAvailability[] = [
      { userId: '1', firstName: 'Аня', dates: [{ date: DATE, timeRanges: [rehearsalRow] }] },
      { userId: '2', firstName: 'Борис', dates: [] },
    ];

    expect(busyOn(mergeMemberAvailability(members, avail), '2')).toEqual([]);
  });

  it('merges overlapping ranges instead of reporting them twice', () => {
    const avail: MemberAvailability[] = [
      {
        userId: '1',
        firstName: 'Аня',
        dates: [
          {
            date: DATE,
            timeRanges: [
              rehearsalRow,
              { start: '15:00', end: '18:00', type: 'busy' } as any,
            ],
          },
        ],
      },
    ];

    expect(busyOn(mergeMemberAvailability(members, avail), '1')).toEqual([
      { start: '14:00', end: '18:00' },
    ]);
  });

  it('counts imported calendar events as busy, and free time as not', () => {
    const avail: MemberAvailability[] = [
      {
        userId: '1',
        firstName: 'Аня',
        dates: [
          {
            date: DATE,
            timeRanges: [
              { start: '09:00', end: '10:00', type: 'tentative' } as any,
              { start: '20:00', end: '21:00', type: 'available' } as any,
            ],
          },
        ],
      },
    ];

    expect(busyOn(mergeMemberAvailability(members, avail), '1')).toEqual([
      { start: '09:00', end: '10:00' },
    ]);
  });
});
