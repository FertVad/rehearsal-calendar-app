import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';
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
 *
 * Every save of the screen goes through here, the question's and its own
 * button's, and while one is out the screen is the one being saved (review
 * T-013 r2): `saving` is on, the screen takes no edits and shows it is
 * saving, and no way out goes until the save is back. Gone through, what was
 * sent is what is saved and the way out asked for goes on; failed, the screen
 * stays with its changes, and the save has said why.
 *
 * A screen's own sheet put away while the screen stays — the editor of
 * "Busy" collapsed — hides its Save with it, and is asked about the same way
 * (T-026): `leave(go)`. "Don't Save" there gives back what was saved
 * (`discard`) before it goes, as there is no leaving screen to take the
 * changes with it; "Save" saves as the screen's own button does, and goes
 * once that went through.
 */
export function useLeaveGuard({ hasChanges, canSave, save, discard }: {
  /** Something here would be lost by leaving. */
  hasChanges: boolean;
  /** A save would go through as things stand — asked when the question comes. */
  canSave: () => boolean;
  /**
   * The screen's own save of what it holds now, marking that as saved: true
   * once it went through. `leaving` — it is the question's "Save".
   */
  save: (leaving: boolean) => Promise<boolean>;
  /** Puts every unsaved change back as saved: "Don't Save" of `leave`. */
  discard?: () => void;
}) {
  // Only to let through the removal it held; that is the same on any screen.
  const navigation = useNavigation<AppNavigation>();
  const { t } = useI18n();

  const [saving, setSaving] = useState(false);
  // The same, for a tap that comes before the render that turns it on.
  const out = useRef(false);
  // The way out to go on with once the save is in and rendered: until then
  // the removal is still held.
  const [saved, setSaved] = useState<WayOut | null>(null);

  const go = (way: WayOut) => {
    if (typeof way === 'function') way();
    // The removal that was held, let through this time.
    else navigation.dispatch(way);
  };

  const run = async (then: WayOut | null): Promise<boolean> => {
    if (out.current) return false;
    out.current = true;
    setSaving(true);
    let done = false;
    try {
      // Only a removal leaves: a sheet put away leaves the screen with its save.
      done = await save(then !== null && typeof then !== 'function');
    } finally {
      out.current = false;
      setSaving(false);
    }
    if (done && then) setSaved(() => then);
    return done;
  };

  const ask = (way: WayOut) => {
    const dontSave = () => {
      if (typeof way === 'function') discard?.();
      go(way);
    };
    const offer = canSave();

    if (Platform.OS !== 'ios') {
      Alert.alert(t.common.unsavedChanges, undefined, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.dontSave, style: 'destructive', onPress: dontSave },
        ...(offer ? [{ text: t.common.save, onPress: () => { run(way); } }] : []),
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
        if (index === 0) dontSave();
        else if (offer && index === 1) run(way);
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
  // Once, in the render the save landed in: its `hasChanges` is the one that
  // counts, and `ask` and `go`, new each render, are that render's (T-243).
  useEffect(() => {
    if (!saved) return;
    setSaved(null);
    if (hasChanges) ask(saved);
    else go(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [saved]);

  return {
    /** A save is out: the screen takes no edits and shows it is saving. */
    saving,
    /** The screen's own save; `then`, the way out to take once it is in. */
    save: (then?: NavigationAction) => run(then ?? null),
    /**
     * A sheet of the screen put away (`go`) with the screen staying: at once
     * with nothing to lose, otherwise once asked. Nothing while a save is out.
     */
    leave: (way: () => void) => {
      if (out.current) return;
      if (hasChanges) ask(way);
      else way();
    },
  };
}

/** A removal held, or a screen's own sheet being put away. */
type WayOut = NavigationAction | (() => void);
