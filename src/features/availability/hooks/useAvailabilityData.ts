import { useState, useEffect } from 'react';
import { availabilityAPI } from '../../../shared/services/api';
import { AvailabilityData, DayMode, DayState } from '../types';

const DEFAULT_SLOT = { start: '10:00', end: '18:00' };

export const useAvailabilityData = () => {
  const [availability, setAvailability] = useState<AvailabilityData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const response = await availabilityAPI.getAll();

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

        if (record.startsAt && record.endsAt) {
          // Extract time from ISO timestamp (e.g., "2025-12-11T10:00:00.000Z" -> "10:00")
          const startsAtDate = new Date(record.startsAt);
          const endsAtDate = new Date(record.endsAt);
          startTime = `${String(startsAtDate.getHours()).padStart(2, '0')}:${String(startsAtDate.getMinutes()).padStart(2, '0')}`;
          endTime = `${String(endsAtDate.getHours()).padStart(2, '0')}:${String(endsAtDate.getMinutes()).padStart(2, '0')}`;
        } else {
          startTime = record.start || record.start_time;
          endTime = record.end || record.end_time;
        }

        const isAllDay = record.isAllDay ?? record.is_all_day;

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

      setAvailability(localData);
    } catch (err) {
      console.error('Failed to load availability:', err);
    } finally {
      setLoading(false);
    }
  };

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
