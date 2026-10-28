import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface PickerDraftOptions {
  visible: boolean;
  /** The value the owner holds; every opening starts from it. */
  value: Date;
  /** The one way a value leaves the picker. */
  onConfirm: (value: Date) => void;
  onClose: () => void;
}

/**
 * A date or time picker's value while it is open (HC02).
 *
 * The spinner used to hand every turn straight to its owner, and Cancel and
 * Done both only closed the sheet — so Cancel kept whatever the wheel had been
 * turned to, along with anything the owner did on a change (the rehearsal form
 * moves the end two hours past a later start). Now the wheel turns a draft:
 * Done confirms it, and Cancel, a tap outside or the back gesture leave the
 * owner's value as it was.
 *
 * Android has no sheet: the native dialog answers once, `set` with a value or
 * `dismissed` without one, and only `set` confirms.
 */
export function usePickerDraft({ visible, value, onConfirm, onClose }: PickerDraftOptions) {
  const [draft, setDraft] = useState(value);
  const time = value.getTime();

  useEffect(() => {
    if (visible) setDraft(new Date(time));
  }, [visible, time]);

  const change = (event: { type?: string } | undefined, picked?: Date) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'set' && picked) onConfirm(picked);
      onClose();
      return;
    }
    if (picked) setDraft(picked);
  };

  const confirm = () => {
    onConfirm(draft);
    onClose();
  };

  return { draft, change, confirm, cancel: onClose };
}
