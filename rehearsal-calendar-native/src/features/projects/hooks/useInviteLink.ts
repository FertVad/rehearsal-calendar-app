import { useState } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { invitesAPI } from '../../../shared/services/api';

export const useInviteLink = () => {
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const generateInviteLink = async (projectId: string) => {
    try {
      setGeneratingInvite(true);
      const response = await invitesAPI.createInvite(projectId);
      const { inviteUrl } = response.data;

      await Clipboard.setStringAsync(inviteUrl);

      Alert.alert(
        'Ссылка скопирована',
        'Ссылка-приглашение скопирована в буфер обмена',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось создать ссылку-приглашение');
    } finally {
      setGeneratingInvite(false);
    }
  };

  return {
    generateInviteLink,
    generatingInvite,
  };
};
