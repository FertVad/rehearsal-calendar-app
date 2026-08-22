import { useState } from 'react';
import { Alert, Share } from 'react-native';
import { invitesAPI } from '../../../shared/services/api';
import { useI18n } from '../../../contexts/I18nContext';

/**
 * Creates an invite link and hands it to the system share sheet.
 *
 * Sharing rather than copying: an invite is nearly always sent to someone, and
 * the sheet drops it straight into Messages or a messenger in one tap. Copying
 * is still available — it is one of the sheet's own actions — so this covers
 * both intents, where a clipboard-only flow covers just the one.
 */
export const useInviteLink = () => {
  const { t } = useI18n();
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const generateInviteLink = async (projectId: string, projectName: string) => {
    try {
      setGeneratingInvite(true);
      const response = await invitesAPI.createInvite(projectId);
      const { inviteUrl } = response.data;

      await Share.share({
        message: `${t.projects.shareInviteMessage(projectName)}\n\n${inviteUrl}`,
        title: t.projects.shareInviteTitle(projectName),
      });
    } catch (err: any) {
      Alert.alert(
        t.common.error,
        err.response?.data?.error || err.message || t.projects.inviteLinkError
      );
    } finally {
      setGeneratingInvite(false);
    }
  };

  return {
    generateInviteLink,
    generatingInvite,
  };
};
