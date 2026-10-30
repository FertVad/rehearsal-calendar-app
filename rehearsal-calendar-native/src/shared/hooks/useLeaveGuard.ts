import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';
import { useI18n } from '../../contexts/I18nContext';
import type { AppNavigation } from '../../navigation/types';

/** The way out a screen's own close takes, as its goBack does. */
export const GO_BACK: NavigationAction = { type: 'GO_BACK' };

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
 *
 * Every save of the screen goes through here, the question's and its own
 * button's, and while one is out the screen is the one being saved (review
 * T-013 r2): `saving` is on, the screen takes no edits and shows it is
 * saving, and no way out goes until the save is back. Gone through, what was
 * sent is what is saved and the way out asked for goes on; failed, the screen
 * stays with its changes, and the save has said why.
 */
export function useLeaveGuard({ hasChanges, canSave, save }: {
  /** Something here would be lost by leaving. */
  hasChanges: boolean;
  /** A save would go through as things stand — asked when the question comes. */
  canSave: () => boolean;
  /**
   * The screen's own save of what it holds now, marking that as saved: true
   * once it went through. `leaving` — it is the question's "Save".
   */
  save: (leaving: boolean) => Promise<boolean>;
}) {
  // Only to let through the removal it held; that is the same on any screen.
  const navigation = useNavigation<AppNavigation>();
  const { t } = useI18n();

  const [saving, setSaving] = useState(false);
  // The same, for a tap that comes before the render that turns it on.
  const out = useRef(false);
  // The way out to go on with once the save is in and rendered: until then
  // the removal is still held.
  const [saved, setSaved] = useState<NavigationAction | null>(null);

  const run = async (then: NavigationAction | null): Promise<boolean> => {
    if (out.current) return false;
    out.current = true;
    setSaving(true);
    let done = false;
    try {
      done = await save(then !== null);
    } finally {
      out.current = false;
      setSaving(false);
    }
    if (done && then) setSaved(then);
    return done;
  };

  const ask = (action: NavigationAction) => {
    // The removal that was held, let through this time.
    const leave = () => navigation.dispatch(action);
    const offer = canSave();

    if (Platform.OS !== 'ios') {
      Alert.alert(t.common.unsavedChanges, undefined, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.dontSave, style: 'destructive', onPress: leave },
        ...(offer ? [{ text: t.common.save, onPress: () => { run(action); } }] : []),
      ]);
      return;
    }

    const options = offer
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
        else if (offer && index === 1) run(action);
      }
    );
  };

  // While a save is out, a way out waits for it: nothing is asked.
  usePreventRemove(hasChanges || saving, ({ data }) => {
    if (!out.current) ask(data.action);
  });

  // Saved and rendered: the way out goes on. What was sent is all there is,
  // nothing having changed meanwhile; should something still be unsaved, it
  // is asked about.
  useEffect(() => {
    if (!saved) return;
    setSaved(null);
    if (hasChanges) ask(saved);
    else navigation.dispatch(saved);
  });

  return {
    /** A save is out: the screen takes no edits and shows it is saving. */
    saving,
    /** The screen's own save; `then`, the way out to take once it is in. */
    save: (then?: NavigationAction) => run(then ?? null),
  };
}
