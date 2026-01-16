import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { RSVPStatus } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useI18n } from '../../../contexts/I18nContext';

export const useRSVP = () => {
  const { t } = useI18n();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  /**
   * Toggle like status for a rehearsal with optimistic UI update
   * Binary like system:
   * - If current status is 'yes' → toggle to null (unlike/remove response)
   * - Otherwise → toggle to 'yes' (like)
   */
  const toggleLike = useCallback(async (
    rehearsalId: string,
    currentStatus: RSVPStatus | null,
    onSuccess: (rehearsalId: string, newStatus: RSVPStatus, stats?: any) => void
  ) => {
    // Toggle logic: 'yes' (liked) ↔ null (unliked)
    // We send 'no' to server to delete the response, but store null in state
    const newStatus: RSVPStatus = currentStatus === 'yes' ? null : 'yes';
    const serverStatus: RSVPStatus = currentStatus === 'yes' ? 'no' : 'yes';

    // Optimistic update - update UI immediately
    onSuccess(rehearsalId, newStatus);

    setRespondingId(rehearsalId);
    try {
      // Send request to server
      const response = await rehearsalsAPI.respond(rehearsalId, serverStatus);

      // Update with actual stats from server
      // Backend returns stats directly in response.data, not in response.data.stats
      if (response.data) {
        onSuccess(rehearsalId, newStatus, response.data);
      }
    } catch (err: any) {
      console.error('Failed to toggle like:', err);
      // Revert optimistic update on error
      onSuccess(rehearsalId, currentStatus);
      Alert.alert(t.common.error, err.message || t.rehearsals.rsvpError || 'Failed to update status');
    } finally {
      setRespondingId(null);
    }
  }, [t]);

  return {
    respondingId,
    toggleLike,
  };
};
