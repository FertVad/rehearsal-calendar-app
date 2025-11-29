import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { RSVPStatus } from '../../../shared/types';
import { rehearsalsAPI } from '../../../shared/services/api';

export const useRSVP = () => {
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const handleRSVP = useCallback(async (
    rehearsalId: string,
    status: 'confirmed' | 'declined',
    onSuccess: (rehearsalId: string, status: RSVPStatus) => void
  ) => {
    setRespondingId(rehearsalId);
    try {
      await rehearsalsAPI.respond(rehearsalId, status);
      onSuccess(rehearsalId, status);
    } catch (err: any) {
      console.error('Failed to submit RSVP:', err);
      Alert.alert('Ошибка', err.message || 'Не удалось отправить ответ');
    } finally {
      setRespondingId(null);
    }
  }, []);

  return {
    respondingId,
    handleRSVP,
  };
};
