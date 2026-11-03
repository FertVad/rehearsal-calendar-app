import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useI18n } from '../../../contexts/I18nContext';
import { useAuth } from '../../../contexts/AuthContext';
import { rehearsalsAPI } from '../../../shared/services/api';
import { unexportRehearsal } from '../../../shared/services/calendarSync';
import { emitDataChanged } from '../../../shared/utils/dataChanged';
import { getDateLocale } from '../../../shared/utils/locale';
import { formatDate } from '../../../shared/utils/dateFormat';
import { formatClock } from '../../../shared/utils/clockFormat';
import { logger } from '../../../shared/utils/logger';
import type { Rehearsal } from '../../../shared/types';
import type { Translations } from '../../../i18n/translations';

/**
 * "сб, 31 окт., 15:00": the day and the start, as the confirmation names them,
 * inside its sentence (dateFormat.ts).
 */
export function rehearsalWhen(r: Rehearsal, language: string): string {
  const start = formatClock(r.time, getDateLocale(language));
  if (!r.date) return start;
  const day = formatDate(r.date, 'weekdayDayMonthShort', language, { midSentence: true });
  return start ? `${day}, ${start}` : day;
}

/**
 * What the confirmation says: which rehearsal, and how many will hear of it —
 * no line when nobody will. A count not read is not nobody: the confirmation
 * does not open on it (useDeleteRehearsal).
 */
export function deletePrompt(
  r: Rehearsal,
  notified: number,
  t: Translations,
  language: string,
): { title: string; message?: string } {
  return {
    title: t.rehearsals.deleteTitle(r.title || null, rehearsalWhen(r, language)),
    message: notified ? t.rehearsals.deleteNotifies(notified) : undefined,
  };
}

/**
 * Deleting a rehearsal, from a card's swipe or from its details: one
 * confirmation for both (T-016).
 *
 * The count is the server's own rule for who hears of it — everyone on the
 * rehearsal but whoever deletes it (routes/native/rehearsals.js) — read from
 * the roster as the confirmation opens. When it cannot be read, there is no
 * confirmation without the line, which would read as "nobody is told": an
 * error says so, and Try again reads it again (review T-016). Once deleted,
 * every list showing rehearsals reloads (`emitDataChanged`), and `onDeleted`
 * lets the caller go.
 */
export function useDeleteRehearsal() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const ownId = user ? String(user.id) : null;

  return useCallback(async function askToDelete(rehearsal: Rehearsal, onDeleted?: () => void) {
    const projectId = rehearsal.projectId;
    if (!projectId) {
      logger.error('[useDeleteRehearsal] projectId missing for rehearsal:', rehearsal.id);
      return;
    }

    let notified: number | null = null;
    try {
      const res = await rehearsalsAPI.getResponses(rehearsal.id);
      const all: any[] | undefined = res.data?.allParticipants;
      if (all) notified = all.filter((p) => String(p.userId) !== ownId).length;
      else logger.warn('[useDeleteRehearsal] Response had no allParticipants');
    } catch (err) {
      logger.warn('[useDeleteRehearsal] Could not read who is on it:', err);
    }
    if (notified === null) {
      Alert.alert(t.common.error, t.rehearsals.deleteNotifiedUnknown, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.retry, onPress: () => { askToDelete(rehearsal, onDeleted); } },
      ]);
      return;
    }

    const { title, message } = deletePrompt(rehearsal, notified, t, language);
    Alert.alert(title, message, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.rehearsals.deleteConfirm,
        style: 'destructive',
        onPress: async () => {
          try {
            await rehearsalsAPI.delete(projectId, rehearsal.id);
          } catch (err: any) {
            logger.error('[useDeleteRehearsal] Failed to delete rehearsal:', err);
            Alert.alert(t.common.error, err.response?.data?.error || err.message || t.rehearsals.deleteError);
            return;
          }

          // Its event, in the sync's queue: after a run already going, which
          // may have read the rehearsal before it was deleted and would put
          // the event back.
          unexportRehearsal(rehearsal.id).catch((syncError) => {
            logger.error('[useDeleteRehearsal] Failed to unsync from calendar:', syncError);
          });

          // The caller goes first: the details listen too, and would read the
          // rehearsal again only to find it gone.
          onDeleted?.();
          emitDataChanged('rehearsals');
        },
      },
    ]);
  }, [t, language, ownId]);
}
