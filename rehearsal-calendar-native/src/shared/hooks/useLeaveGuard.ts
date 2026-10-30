import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useI18n } from '../../contexts/I18nContext';
import type { AppNavigation } from '../../navigation/types';

/**
 * A sheet with unsaved changes is not left without asking (T-013).
 *
 * Every way out of a screen removes its route — the close button's goBack,
 * the swipe down, the system's back — and this stands in front of the
 * removal itself, so no way out has to remember to ask. In the native stack
 * it also holds the swipe: the sheet springs back and the question comes.
 * With nothing changed it is not there and the screen closes at once.
 *
 * The question is an action sheet, as the HIG asks of a sheet dismissed with
 * changes (sheets.md, modality.md): "Don't Save", "Save" when the changes can
 * be saved as they are, and "Cancel".
 */
export function useLeaveGuard({ hasChanges, canSave, onSave }: {
  /** Something here would be lost by leaving. */
  hasChanges: boolean;
  /** A save would go through as things stand — asked when the question comes. */
  canSave: () => boolean;
  /** The screen's own save; `leave` finishes the way out once it has saved. */
  onSave: (leave: () => void) => void;
}) {
  // Only to let through the removal it held; that is the same on any screen.
  const navigation = useNavigation<AppNavigation>();
  const { t } = useI18n();

  usePreventRemove(hasChanges, ({ data }) => {
    // The removal that was held, let through this time.
    const leave = () => navigation.dispatch(data.action);
    const save = canSave();

    if (Platform.OS !== 'ios') {
      Alert.alert(t.common.unsavedChanges, undefined, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.dontSave, style: 'destructive', onPress: leave },
        ...(save ? [{ text: t.common.save, onPress: () => onSave(leave) }] : []),
      ]);
      return;
    }

    const options = save
      ? [t.common.dontSave, t.common.save, t.common.cancel]
      : [t.common.dontSave, t.common.cancel];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        destructiveButtonIndex: 0,
        cancelButtonIndex: options.length - 1,
        userInterfaceStyle: 'dark',
      },
      (index) => {
        if (index === 0) leave();
        else if (save && index === 1) onSave(leave);
      }
    );
  });
}
