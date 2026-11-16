export type SlotCategory = 'perfect' | 'good' | 'ok' | 'bad';

export interface BusyMember {
  id: string;
  name: string;
  busyRanges: Array<{ start: string; end: string }>;
}

export interface TimeSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  /**
   * HH:mm, where the first of the people free at the start becomes busy, or
   * the working day ends. Not `endTime`: a slot ends when anyone's state
   * changes, someone busy coming free too (T-238).
   */
  freeUntil: string;
  category: SlotCategory;
  totalMembers: number;
  freeMembers: number;
  busyMembers: BusyMember[];
}

export interface Member {
  id: string;
  name: string;
  isAdmin?: boolean;
}

export interface AvailabilityData {
  memberId: string;
  date: string;
  busyRanges: Array<{ start: string; end: string }>;
}
