import { useState } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { invitesAPI } from '../../../shared/services/api';
import { useI18n } from '../../../contexts/I18nContext';

export const useInviteLink = () => {
  const { t } = useI18n();
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const generateInviteLink = async (projectId: string) => {
    try {
      setGeneratingInvite(true);
      const response = await invitesAPI.createInvite(projectId);
      const { inviteUrl } = response.data;

      await Clipboard.setStringAsync(inviteUrl);

      Alert.alert(
        t.projects.linkCopied,
        t.projects.inviteLinkCopied,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert(t.common.error, err.message || t.projects.inviteLinkError);
    } finally {
      setGeneratingInvite(false);
    }
  };

  return {
    generateInviteLink,
    generatingInvite,
  };
};
