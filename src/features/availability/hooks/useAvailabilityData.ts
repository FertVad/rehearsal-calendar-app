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
        // Extract date without timezone offset
        const dateStr = record.date.split('T')[0];
        if (!serverData[dateStr]) {
          serverData[dateStr] = [];
        }

        // Handle both old format (start_time/end_time) and new format (start/end)
        const startTime = record.start || record.start_time;
        const endTime = record.end || record.end_time;
        const isAllDay = record.isAllDay ?? record.is_all_day;

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
        const typedSlots = slots as Array<{ startTime: string; endTime: string; type: string }>;
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
        const formatTime = (time: string) => time.substring(0, 5);

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
