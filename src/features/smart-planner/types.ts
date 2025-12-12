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
  category: SlotCategory;
  totalMembers: number;
  freeMembers: number;
  busyMembers: BusyMember[];
}

export interface Member {
  id: string;
  name: string;
}

export interface AvailabilityData {
  memberId: string;
  date: string;
  busyRanges: Array<{ start: string; end: string }>;
}
