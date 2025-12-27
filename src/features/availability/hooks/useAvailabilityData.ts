import { useState, useEffect, useCallback } from 'react';
import { availabilityAPI } from '../../../shared/services/api';
import { AvailabilityData, DayMode, DayState } from '../types';

const DEFAULT_SLOT = { start: '10:00', end: '18:00' };

export const useAvailabilityData = () => {
  const [availability, setAvailability] = useState<AvailabilityData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const response = await availabilityAPI.getAll();

      console.log('[useAvailabilityData] Received response:', response.data?.length, 'records');
      console.log('[useAvailabilityData] Sample records:', JSON.stringify(response.data?.slice(0, 3), null, 2));

      // Old API returns array directly in response.data
      const rawRecords = Array.isArray(response.data) ? response.data : [];

      // Group by date
      const serverData: Record<string, Array<{ startTime: string; endTime: string; type: string; isAllDay?: boolean; source?: string }>> = {};
      for (const record of rawRecords) {
        // Extract date from startsAt (ISO timestamp) or legacy date field
        const dateSource = record.startsAt || record.date;
        if (!dateSource) continue;

        // Extract date without timezone offset
        const dateStr = dateSource.split('T')[0];
        if (!serverData[dateStr]) {
          serverData[dateStr] = [];
        }

        // Handle multiple formats:
        // - New TIMESTAMPTZ: startsAt/endsAt (ISO 8601)
        // - Old format: start/end or start_time/end_time (HH:mm)
        let startTime, endTime;

        const isAllDay = record.isAllDay ?? record.is_all_day;

        if (record.startsAt && record.endsAt) {
          // For all-day events, use standard 00:00 - 23:59 regardless of actual timestamps
          if (isAllDay) {
            startTime = '00:00';
            endTime = '23:59';
          } else {
            // Extract time from ISO timestamp (e.g., "2025-12-11T10:00:00.000Z" -> "10:00")
            const startsAtDate = new Date(record.startsAt);
            const endsAtDate = new Date(record.endsAt);
            startTime = `${String(startsAtDate.getHours()).padStart(2, '0')}:${String(startsAtDate.getMinutes()).padStart(2, '0')}`;
            endTime = `${String(endsAtDate.getHours()).padStart(2, '0')}:${String(endsAtDate.getMinutes()).padStart(2, '0')}`;
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

      console.log('[useAvailabilityData] Converted to localData:', Object.keys(localData).length, 'dates');
      console.log('[useAvailabilityData] Sample dates:', JSON.stringify(
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
  }, []);

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
