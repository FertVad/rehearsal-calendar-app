import { logger } from '../../../shared/utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { availabilityAPI } from '../../../shared/services/api';
import { AvailabilityData, DayMode, DayState } from '../types';
import {
  isoToDateStringInTimezone,
  isoToTimeStringInTimezone,
} from '../../../shared/utils/time';
import { useAuth } from '../../../contexts/AuthContext';

const DEFAULT_SLOT = { start: '10:00', end: '18:00' };

export const useAvailabilityData = () => {
  const [availability, setAvailability] = useState<AvailabilityData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // ✅ Get user's timezone from AuthContext
  const { user } = useAuth();
  const userTimezone = user?.timezone || 'UTC';

  const loadAvailability = useCallback(async () => {
    try {
      setLoading(true);
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
        const dateStr = record.startsAt
          ? isAllDay
            ? record.startsAt.split('T')[0]
            : isoToDateStringInTimezone(record.startsAt, userTimezone)
          : dateSource.split('T')[0];

        if (!serverData[dateStr]) {
          serverData[dateStr] = [];
        }

        // Handle multiple formats:
        // - New TIMESTAMPTZ: startsAt/endsAt (ISO 8601)
        // - Old format: start/end or start_time/end_time (HH:mm)
        let startTime, endTime;

        if (record.startsAt && record.endsAt) {
          // For all-day events, use standard 00:00 - 23:59 regardless of actual timestamps
          if (isAllDay) {
            startTime = '00:00';
            endTime = '23:59';
          } else {
            // ✅ FIXED: Extract time in user's timezone
            startTime = isoToTimeStringInTimezone(record.startsAt, userTimezone);
            endTime = isoToTimeStringInTimezone(record.endsAt, userTimezone);
          }
        } else {
          startTime = record.start || record.start_time;
          endTime = record.end || record.end_time;
        }

        // Skip if we couldn't extract valid times
        if (!startTime || !endTime) continue;

        serverData[dateStr].push({
          startTime,
          endTime,
          type: record.type,
          isAllDay,
          source: record.source
        });
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
        const typedSlots = slots as Array<{ startTime: string; endTime: string; type: string; isAllDay?: boolean }>;
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

        // Determine mode based on type and isAllDay flag
        const firstSlot = typedSlots[0];
        let mode: DayMode = 'free';

        // Strip seconds from time (HH:MM:SS -> HH:MM)
        const formatTime = (time: string) => time?.substring(0, 5) || '00:00';

        // Check if this is an all-day slot using the isAllDay flag
        if (firstSlot.isAllDay) {
          if (firstSlot.type === 'busy') {
            mode = 'busy';
          } else if (firstSlot.type === 'available') {
            mode = 'free';
          }
        } else {
          mode = 'custom';
        }

        localData[formattedDate] = {
          mode,
          slots: typedSlots.map(s => ({
            start: formatTime(s.startTime),
            end: formatTime(s.endTime)
          })),
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
    saving,
    setSaving,
    hasChanges,
    setHasChanges,
    getDayState,
    loadAvailability,
  };
};
