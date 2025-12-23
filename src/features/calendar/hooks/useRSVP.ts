import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { RSVPStatus } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';

export const useRSVP = () => {
  const [respondingId, setRespondingId] = useState<string | null>(null);

  /**
   * Toggle like status for a rehearsal with optimistic UI update
   * - If current status is 'yes' → toggle to null (unlike - deletes response)
   * - Otherwise → toggle to 'yes' (like)
   */
  const toggleLike = useCallback(async (
    rehearsalId: string,
    currentStatus: RSVPStatus | null,
    onSuccess: (rehearsalId: string, newStatus: RSVPStatus, stats?: any) => void
  ) => {
    // Toggle logic: 'yes' (liked) ↔ null (unliked/deleted)
    const newStatus: RSVPStatus = currentStatus === 'yes' ? null : 'yes';

    // Optimistic update - update UI immediately
    onSuccess(rehearsalId, newStatus);

    setRespondingId(rehearsalId);
    try {
      // Send request to server
      const response = await rehearsalsAPI.respond(rehearsalId, newStatus);

      // Update with actual stats from server
      if (response.data.stats) {
        onSuccess(rehearsalId, newStatus, response.data.stats);
      }
    } catch (err: any) {
      console.error('Failed to toggle like:', err);
      // Revert optimistic update on error
      onSuccess(rehearsalId, currentStatus);
      Alert.alert('Ошибка', err.message || 'Не удалось обновить статус');
    } finally {
      setRespondingId(null);
    }
  }, []);

  return {
    respondingId,
    toggleLike,
  };
};
