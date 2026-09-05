import { logger } from '../../../shared/utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { availabilityAPI } from '../../../shared/services/api';
import { AvailabilityData, DayMode, DayState, TimeSlot } from '../types';
import {
  isoToDateStringInTimezone,
  isoToTimeStringInTimezone,
  datesBetween,
} from '../../../shared/utils/time';
import { useAuth } from '../../../contexts/AuthContext';

const DEFAULT_SLOT = { start: '10:00', end: '18:00' };

export const useAvailabilityData = () => {
  const [availability, setAvailability] = useState<AvailabilityData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Whether the last load actually answered.
  //
  // A failure used to leave the state empty and say nothing, and the screen
  // reads an empty state as "you have marked nothing, so you are counted as
  // free" — which offline is false twice over: the availability is safe on the
  // server, and nobody is being told anything different.
  const [loadFailed, setLoadFailed] = useState(false);

  // ✅ Get user's timezone from AuthContext
  const { user } = useAuth();
  const userTimezone = user?.timezone || 'UTC';

  const loadAvailability = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const response = await availabilityAPI.getAll();

      logger.debug('[useAvailabilityData] Received response:', response.data?.length, 'records');
      logger.debug('[useAvailabilityData] Sample records:', JSON.stringify(response.data?.slice(0, 3), null, 2));

      // Old API returns array directly in response.data
      const rawRecords = Array.isArray(response.data) ? response.data : [];

      // Group by date
      const serverData: Record<string, Array<{ startTime: string; endTime: string; type: string; isAllDay?: boolean; source?: string }>> = {};
      for (const record of rawRecords) {
        // Extract date from startsAt (ISO timestamp) or legacy date field
        const dateSource = record.startsAt || record.date;
        if (!dateSource) continue;

        const isAllDay = record.isAllDay ?? record.is_all_day;

        // A whole-day entry is written as `${localDate}T00:00:00.000Z` — UTC
        // midnight standing for a calendar date, not for an instant. That is
        // the app-wide convention and the server's delete keys on it too. So
        // read it back as the date it says, and convert only the timed rows,
        // which carry a real offset and do mean an instant.
        //
        // Converting an all-day row moved it a day earlier for anyone at a
        // negative offset: a New York user marking 10 September saw 9 September
        // marked and 10 September free, and each save after a reload walked it
        // another day back. Nobody east of UTC ever saw it, which is why it
        // survived — the current users are all in Berlin, Moscow and Jerusalem.
        const push = (dateStr: string, startTime: string, endTime: string) => {
          if (!startTime || !endTime) return;
          if (!serverData[dateStr]) serverData[dateStr] = [];
          serverData[dateStr].push({
            startTime,
            endTime,
            type: record.type,
            isAllDay,
            source: record.source,
          });
        };

        // Legacy shape: a bare date with HH:mm times, no span to speak of.
        if (!record.startsAt || !record.endsAt) {
          push(
            dateSource.split('T')[0],
            record.start || record.start_time,
            record.end || record.end_time
          );
          continue;
        }

        // A record covers every day between its ends, and the grid holds one
        // list of HH:mm ranges per day — so it has to be cut up, clipped to each
        // day. Filing it under its start date alone lost everything after the
        // first: a calendar event running 3 September 20:00 to 6 September 21:00
        // showed up as "3 September, 20:00–21:00" and left the 4th, 5th and 6th
        // looking free, which is how two imported periods could be in the
        // database and invisible on the screen.
        const firstDate = isAllDay
          ? record.startsAt.split('T')[0]
          : isoToDateStringInTimezone(record.startsAt, userTimezone);
        const lastDate = isAllDay
          ? record.endsAt.split('T')[0]
          : isoToDateStringInTimezone(record.endsAt, userTimezone);

        if (isAllDay) {
          for (const day of datesBetween(firstDate, lastDate)) {
            push(day, '00:00', '23:59');
          }
          continue;
        }

        const startTime = isoToTimeStringInTimezone(record.startsAt, userTimezone);
        const endTime = isoToTimeStringInTimezone(record.endsAt, userTimezone);

        if (firstDate === lastDate) {
          push(firstDate, startTime, endTime);
          continue;
        }

        push(firstDate, startTime, '23:59');
        for (const day of datesBetween(firstDate, lastDate).slice(1, -1)) {
          push(day, '00:00', '23:59');
        }
        // An end of exactly midnight belongs to the day before, not as a
        // zero-length sliver on the next one.
        if (endTime !== '00:00') {
          push(lastDate, '00:00', endTime);
        }
      }

      // DEDUPLICATION: Remove duplicate time slots (prioritize rehearsal > manual)
      // If same time range exists with different sources, keep only rehearsal
      for (const dateStr in serverData) {
        const slots = serverData[dateStr];
        const uniqueSlots: typeof slots = [];
        const seenTimeRanges = new Set<string>();

        // First pass: add all rehearsal slots
        for (const slot of slots) {
          if (slot.source === 'rehearsal') {
            const key = `${slot.startTime}-${slot.endTime}`;
            uniqueSlots.push(slot);
            seenTimeRanges.add(key);
          }
        }

        // Second pass: add manual/other slots only if time range not already covered by rehearsal
        for (const slot of slots) {
          if (slot.source !== 'rehearsal') {
            const key = `${slot.startTime}-${slot.endTime}`;
            if (!seenTimeRanges.has(key)) {
              uniqueSlots.push(slot);
              seenTimeRanges.add(key);
            } else {
              console.log(`[useAvailabilityData] Skipping duplicate ${slot.source} slot on ${dateStr} ${key} (covered by rehearsal)`);
            }
          }
        }

        serverData[dateStr] = uniqueSlots;
      }

      // Convert server format to local format
      const localData: AvailabilityData = {};
      for (const [dateKey, slots] of Object.entries(serverData)) {
        const typedSlots = slots as Array<{ startTime: string; endTime: string; type: string; isAllDay?: boolean; source?: string }>;
        if (typedSlots.length === 0) continue;

        // Ensure date is in YYYY-MM-DD format
        let formattedDate = dateKey;
        if (!dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dateObj = new Date(dateKey);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        }

        // Strip seconds from time (HH:MM:SS -> HH:MM)
        const formatTime = (time: string) => time?.substring(0, 5) || '00:00';

        // Rows the user did not type: events read out of the phone's calendar,
        // and the busy time a rehearsal books. They are shown but never edited
        // here, and a save must not copy them into hand-entered rows.
        const readOnly = typedSlots.filter(
          (s) => s.source && s.source !== 'manual'
        );
        const own = typedSlots.filter((s) => !s.source || s.source === 'manual');

        // The day's own declaration. The all-day row is searched for rather
        // than assumed to be first: the deduplication above puts rehearsal rows
        // in front, and a timed row can sort ahead of it anyway.
        const allDay = own.find((s) => s.isAllDay);
        let mode: DayMode = allDay ? (allDay.type === 'busy' ? 'busy' : 'free') : 'custom';

        // Show the fact, not just the declaration. A day marked free while the
        // phone's calendar has an event on it is not free — the endpoint that
        // feeds everyone else's planner reports that event as busy, so the
        // owner has to see it too. Hiding what others act on is the whole
        // trouble this fixes. A day marked busy already covers it, so that
        // declaration stands.
        if (mode === 'free' && readOnly.length > 0) {
          mode = 'custom';
        }

        localData[formattedDate] = {
          mode,
          // An all-day declaration is the mode, not a slot — carrying it here
          // as 00:00–23:59 would show up as an editable row and be written back
          // as a timed one. Only that row is left out; any timed rows the user
          // entered stay, so switching the mode does not lose them.
          slots: own.filter((s) => !s.isAllDay).map((s) => ({
            start: formatTime(s.startTime),
            end: formatTime(s.endTime),
          })),
          importedSlots: readOnly.map((s) => {
            const start = formatTime(s.startTime);
            const end = formatTime(s.endTime);
            return {
              start,
              end,
              source: s.source as TimeSlot['source'],
              // Either a whole-day entry, or one day in the middle of an event
              // spanning several — both take the day entirely, and showing them
              // as 00:00–23:59 hours reads as "partly busy" for a day that has
              // nothing free left in it.
              isAllDay: s.isAllDay || (start === '00:00' && end === '23:59'),
            };
          }),
        };
      }

      logger.debug('[useAvailabilityData] Converted to localData:', Object.keys(localData).length, 'dates');
      logger.debug('[useAvailabilityData] Sample dates:', JSON.stringify(
        Object.entries(localData).slice(0, 3).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
        null,
        2
      ));

      setAvailability(localData);
    } catch (err) {
      console.error('Failed to load availability:', err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userTimezone]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const getDayState = (date: string): DayState => {
    return availability[date] || { mode: 'free', slots: [{ ...DEFAULT_SLOT }] };
  };

  return {
    availability,
    setAvailability,
    loading,
    loadFailed,
    saving,
    setSaving,
    hasChanges,
    setHasChanges,
    getDayState,
    loadAvailability,
  };
};
