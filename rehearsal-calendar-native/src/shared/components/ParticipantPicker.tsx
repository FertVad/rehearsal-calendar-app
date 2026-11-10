import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../constants/colors';
import type { TimeRange } from '../utils/availability';
import { formatTimeRange } from '../utils/clockFormat';
import { useI18n } from '../../contexts/I18nContext';
import type { Translations } from '../../i18n/translations';
import { AppModal } from './AppModal';
import { ModalSheet } from './ModalSheet';
import { UserAvatar } from './UserAvatar';

export interface PickerPerson {
  id: string;
  name: string;
  isAdmin?: boolean;
  /** Their busy time, only for someone who is busy: "10:00–14:00". */
  busy?: string;
}

interface ParticipantPickerProps {
  people: PickerPerson[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  loading?: boolean;
  /** What the row says with nobody picked, where that means everyone (the planner). */
  noneLabel?: string;
  /** A second line under the row, for someone picked who is busy then. */
  conflict?: string;
  /**
   * The people by their faces, "(A)(B)(C)+5 All participants · 8 ›": the
   * planner, under its period (T-241). The same sheet opens.
   */
  faces?: boolean;
}

/** Past this many people the sheet gets a search field. */
export const SEARCH_OVER = 12;

/** Faces shown in the stack before "+N". */
const FACES = 3;
const FACE_SIZE = 28;

/** "Olga Stage" as the avatar takes it: initials of the first and last word. */
function nameParts(name: string): { firstName: string; lastName?: string } {
  const words = name.trim().split(/\s+/);
  return { firstName: words[0] ?? '', lastName: words.length > 1 ? words[words.length - 1] : undefined };
}

/**
 * Who takes part: one row that says how many are picked, and a sheet to pick
 * them. The rehearsal form and the planner both use it.
 *
 * They had a component each, the same twice with different words: a tick
 * box that said what it would do ("Clear" beside a tick), an "Expand" button,
 * and a summary drawn like a button — 107 and 115 pt shut, about 70 pt a
 * person open, and the list open inside the screen's scroll with its own
 * (owner, 29.10.2026; T-010). Everything here says how things are, not what a
 * tap will do, and the only list that scrolls is the sheet's.
 */
export function ParticipantPicker({
  people,
  selectedIds,
  onChange,
  loading = false,
  noneLabel,
  conflict,
  faces = false,
}: ParticipantPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // The selection as it is, not as it should be: a stale seed reading
  // "3 of 2" must show (DP01).
  const picked = selectedIds.length;
  const value = loading
    ? t.rehearsals.loadingMembers
    : people.length === 0
      ? t.rehearsals.noMembers
      : picked === 0 && noneLabel
        ? noneLabel
        : t.rehearsals.participantsCount(picked, people.length);
  const disabled = loading || people.length === 0;
  // Everyone, or nobody where that means everyone: "All participants · 4".
  const everyone = !disabled && (picked === people.length || (picked === 0 && !!noneLabel));

  const sheet = (
    <ParticipantSheet
      visible={open}
      onClose={() => setOpen(false)}
      people={people}
      selectedIds={selectedIds}
      onChange={onChange}
      t={t}
    />
  );

  if (faces) {
    // The ones picked, everyone where that is everyone; three faces, then "+N".
    const shown = everyone ? people : people.filter(p => selectedIds.includes(p.id));
    const more = shown.length - FACES;
    // Its own row, the whole width: in a row of three it was cut in the middle
    // in every language, "Partici…: all (8)" (owner, 09.11; T-241). The words
    // wrap rather than end in "…".
    const facesText = disabled ? value : everyone
      ? t.rehearsals.participantsEveryone(people.length)
      : t.rehearsals.participantsCount(picked, people.length);
    return (
      <>
        <TouchableOpacity
          testID="participants-row"
          style={styles.faces}
          onPress={() => setOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={[t.rehearsals.participants, value].join(', ')}
          accessibilityState={{ disabled }}
        >
          {shown.length > 0 && (
            <View testID="participants-faces" style={styles.faceStack}>
              {shown.slice(0, FACES).map((person, index) => (
                <View key={person.id} style={index > 0 && styles.faceOverlap}>
                  <UserAvatar {...nameParts(person.name)} size={FACE_SIZE} />
                </View>
              ))}
              {more > 0 && (
                <View style={[styles.faceOverlap, styles.faceMore]}>
                  <Text style={styles.faceMoreText}>{`+${more}`}</Text>
                </View>
              )}
            </View>
          )}
          <Text style={styles.facesText}>{facesText}</Text>
          {!disabled && <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />}
        </TouchableOpacity>
        {sheet}
      </>
    );
  }

  return (
    <>
      <TouchableOpacity
        testID="participants-row"
        style={styles.row}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={[t.rehearsals.participants, value, conflict].filter(Boolean).join(', ')}
        accessibilityState={{ disabled }}
      >
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{t.rehearsals.participants}</Text>
          <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
          {!disabled && <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />}
        </View>
        {conflict ? (
          <Text testID="participants-conflict" style={styles.conflict} numberOfLines={1}>
            {conflict}
          </Text>
        ) : null}
      </TouchableOpacity>

      {sheet}
    </>
  );
}

function ParticipantSheet({
  visible,
  onClose,
  people,
  selectedIds,
  onChange,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  people: PickerPerson[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  t: Translations;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const picked = selectedIds.length;
  const all = people.length > 0 && people.every(p => selectedIds.includes(p.id));
  const checked: boolean | 'mixed' = all ? true : picked === 0 ? false : 'mixed';

  // A search lasts while the sheet is open, and narrows the list only where
  // its field is there to see and clear. Kept after closing, it emptied the
  // sheet of a project of two opened next: no rows, and no field (T-010 review).
  const searchable = people.length > SEARCH_OVER;
  const shown = useMemo(() => {
    const q = searchable ? query.trim().toLocaleLowerCase() : '';
    return q ? people.filter(p => p.name.toLocaleLowerCase().includes(q)) : people;
  }, [people, query, searchable]);
  const close = () => {
    setQuery('');
    onClose();
  };

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(s => s !== id) : [...selectedIds, id]);
  };
  // Some picked, or none: everyone. Everyone: nobody.
  const toggleAll = () => onChange(all ? [] : people.map(p => p.id));

  // The sheet sits on the keyboard while the search types: a search that
  // leaves one person shrinks it, and it went under the keyboard with them.
  return (
    <AppModal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        testID="participants-keyboard"
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ModalSheet overlayStyle={styles.overlay} onClose={close}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.header}>
              <Text style={styles.title}>{t.rehearsals.participants}</Text>
              <TouchableOpacity
                testID="participants-done"
                onPress={close}
                accessibilityRole="button"
                style={styles.doneButton}
              >
                <Text style={styles.done}>{t.common.done}</Text>
              </TouchableOpacity>
            </View>

            {searchable && (
              <View style={styles.search}>
                <Ionicons name="search" size={16} color={Colors.text.tertiary} />
                <TextInput
                  testID="participants-search"
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t.rehearsals.searchParticipants}
                  placeholderTextColor={Colors.text.tertiary}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>
            )}

            <Pressable
              testID="participants-all"
              style={styles.allRow}
              onPress={toggleAll}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={`${t.rehearsals.allParticipants}, ${t.rehearsals.participantsCount(picked, people.length)}`}
            >
              <Checkbox checked={checked} />
              <Text style={styles.allText}>{t.rehearsals.allParticipants}</Text>
              <Text style={styles.side}>{t.rehearsals.participantsCount(picked, people.length)}</Text>
            </Pressable>

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {shown.map(person => {
                const on = selectedIds.includes(person.id);
                return (
                  <Pressable
                    key={person.id}
                    testID={`participant-${person.id}`}
                    style={styles.personRow}
                    onPress={() => toggle(person.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={[person.name, person.isAdmin && t.rehearsals.admin, person.busy]
                      .filter(Boolean).join(', ')}
                  >
                    <Checkbox checked={on} />
                    <View style={styles.nameLine}>
                      <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
                      {person.isAdmin && <Text style={styles.admin}>{t.rehearsals.admin}</Text>}
                    </View>
                    {person.busy ? (
                      <Text style={[styles.side, styles.busy]} numberOfLines={1}>{person.busy}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </ModalSheet>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

function Checkbox({ checked }: { checked: boolean | 'mixed' }) {
  return (
    <View style={[styles.box, checked !== false && styles.boxOn]}>
      {checked === true && <Ionicons name="checkmark" size={16} color="#fff" />}
      {checked === 'mixed' && <Ionicons name="remove" size={16} color="#fff" />}
    </View>
  );
}

/**
 * Someone's busy time on a day, as the sheet shows it beside their name: the
 * ranges, or the whole day. Nothing for someone free. Busy as the conflict
 * check on save counts it (conflictDetection.ts): rows of type 'busy'.
 */
export function busyText(ranges: TimeRange[] | undefined, t: Translations, locale: string, uses24: boolean): string | undefined {
  const busy = (ranges ?? []).filter(r => r.type === 'busy');
  if (busy.length === 0) return undefined;
  if (busy.length === 1 && busy[0].start === '00:00' && (busy[0].end === '23:59' || busy[0].end === '24:00')) {
    return t.rehearsals.wholeDay;
  }
  return busy.map(r => formatTimeRange(r.start, r.end, locale, uses24)).join(', ');
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowTitle: {
    flex: 1,
    fontSize: 17,
    color: Colors.text.primary,
  },
  rowValue: {
    fontSize: 17,
    color: Colors.text.secondary,
    flexShrink: 1,
  },
  faces: {
    minHeight: TouchTarget + Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
  },
  faceStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faceOverlap: {
    // A little over each other, both initials still whole.
    marginLeft: -Spacing.xs,
  },
  faceMore: {
    width: FACE_SIZE,
    height: FACE_SIZE,
    borderRadius: FACE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  faceMoreText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  facesText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  conflict: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.accent.yellow,
  },
  keyboard: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  // 44 pt of its own rather than a hitSlop reaching past the header.
  doneButton: {
    minWidth: TouchTarget,
    minHeight: TouchTarget,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  done: {
    fontSize: 17,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: TouchTarget,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bg.tertiary,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: Colors.text.primary,
  },
  allRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  allText: {
    flex: 1,
    fontSize: 17,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  // As tall as its rows, and no taller than the room the sheet has left:
  // less with the keyboard up.
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  personRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  nameLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: 17,
    color: Colors.text.primary,
  },
  admin: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
  },
  side: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  busy: {
    color: Colors.accent.yellow,
    maxWidth: '40%',
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: Colors.accent.purple,
    borderColor: Colors.accent.purple,
  },
});
