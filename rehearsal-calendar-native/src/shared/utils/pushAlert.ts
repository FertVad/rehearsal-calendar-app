import { Alert, Linking } from 'react-native';
import type { Translations } from '../../i18n/translations';
import type { PushRegistration } from '../services/notifications';

/**
 * Tells the person that this device did not get registered for push, and why
 * (cause fix 20, GC02). The profile took every outcome for success — a
 * refusal, a simulator, a dropped connection — and left the switch on with a
 * success buzz, while the phone would never be notified.
 *
 * A refusal can only be undone in Settings, so that one offers the way there.
 */
export function explainPushRegistration(result: Exclude<PushRegistration, 'registered'>, t: Translations) {
  switch (result) {
    case 'denied':
      Alert.alert(t.profile.pushDeniedTitle, t.profile.pushDeniedMessage, [
        { text: t.profile.cancel, style: 'cancel' },
        { text: t.profile.openSettings, onPress: () => { Linking.openSettings().catch(() => undefined); } },
      ]);
      return;
    case 'unsupported':
      Alert.alert(t.profile.notifications, t.profile.pushUnsupported);
      return;
    case 'failed':
      Alert.alert(t.profile.errorTitle, t.profile.pushFailed);
      return;
  }
}
