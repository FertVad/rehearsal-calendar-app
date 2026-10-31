import React, { useRef } from 'react';
import { View, Text } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
// The card is inside a Swipeable, and React Native's own touchables take no
// part in gesture-handler's arbitration: a swipe let slide back would open the
// details as well (as in the inbox, NotificationsScreen).
import { TouchableOpacity as GestureTouchable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '../../../shared/components/IconButton';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { calendarScreenStyles as styles } from '../styles';
import { useI18n } from '../../../contexts/I18nContext';
import { useSeen } from '../../../contexts/SeenContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { rehearsalTimeLabel } from '../../../shared/utils/rehearsalDays';
import { useDeleteRehearsal } from '../hooks/useDeleteRehearsal';
import type { AppNavigation } from '../../../navigation';

interface RehearsalCardProps {
  rehearsal: Rehearsal;
  /** Shown as a badge above the time — "Today", "Tomorrow", a date. Omitted
   *  under a heading that already says which day these belong to. */
  dateLabel?: string;
  /** The two lists disagreed on where this comes from — one read the project
   *  the rehearsal belongs to, the other the name denormalised onto it. The
   *  caller decides now. */
  projectName?: string;
  isAdmin: boolean;
  isSynced?: boolean;
  onPress: () => void;
}

/**
 * One rehearsal, as it appears in a list.
 *
 * Today's rehearsals and the upcoming ones used to render this separately, so
 * every change had to be made twice — which is how the rehearsal title nearly
 * shipped visible in one list and missing from the other.
 *
 * An admin edits and deletes it with a swipe to the left (T-016). The pencil
 * and the bin used to sit on the card, the bin 16 pt from the pencil, and a
 * tap meant for one could land on the other.
 */
export default function RehearsalCard({
  rehearsal,
  dateLabel,
  projectName,
  isAdmin,
  isSynced = false,
  onPress,
}: RehearsalCardProps) {
  const { t, language } = useI18n();
  const navigation = useNavigation<AppNavigation>();
  const askToDelete = useDeleteRehearsal();
  const swipeable = useRef<Swipeable>(null);

  // Read straight from the store. These used to arrive as five props threaded
  // from the screen through every list in between, which is why a second list
  // could only show this card by being handed its own copy of the state.
  const { responseFor, statsFor, isResponding, toggleSeen } = useSeen();
  const currentResponse = responseFor(rehearsal.id);
  const stats = statsFor(rehearsal.id);
  const responding = isResponding(rehearsal.id);

  const seenLabel =
    stats && (stats.confirmed > 0 || isAdmin)
      ? isAdmin && stats.invited > 0
        ? `${stats.confirmed}/${stats.invited}`
        : `${stats.confirmed}`
      : null;

  const card = (
    <View style={styles.upcomingCard}>
      <GestureTouchable onPress={onPress} activeOpacity={0.7}>
        <View style={styles.upcomingCardRow}>
          <View style={styles.upcomingCardLeftCol}>
            {dateLabel ? (
              <View style={styles.upcomingCardHeader}>
                <View style={styles.upcomingDateBadge}>
                  <Text style={styles.upcomingDateText}>{dateLabel}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.upcomingContent}>
              <View style={styles.upcomingTimeRow}>
                <Ionicons name="time-outline" size={14} color={Colors.accent.purple} />
                <Text style={styles.upcomingTime} testID="rehearsal-card-time">
                  {rehearsalTimeLabel(rehearsal, getDateLocale(language))}
                </Text>
                {isSynced && (
                  <Ionicons name="calendar" size={14} color={Colors.accent.green} />
                )}
              </View>

              {rehearsal.title ? (
                <Text style={styles.upcomingTitle} numberOfLines={2}>
                  {rehearsal.title}
                </Text>
              ) : null}

              {projectName && (
                <View style={styles.upcomingProjectRow}>
                  <Ionicons name="folder-outline" size={14} color={Colors.accent.blue} />
                  <Text style={styles.upcomingProject} numberOfLines={1}>
                    {projectName}
                  </Text>
                </View>
              )}

              {rehearsal.location && (
                <View style={styles.upcomingLocationRow}>
                  <Ionicons name="location-outline" size={14} color={Colors.text.secondary} />
                  <Text style={styles.upcomingLocation} numberOfLines={1}>
                    {rehearsal.location}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {isAdmin && (
            <View style={styles.upcomingCardAdminCol}>
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color={Colors.accent.purple} />
                <Text style={styles.adminBadgeText}>{t.projects.admin}</Text>
              </View>
            </View>
          )}
        </View>
      </GestureTouchable>

      <View style={styles.seenSection}>
        {/* Only an icon until someone has seen it: then the count beside it. */}
        <IconButton
          testID="seen-toggle"
          icon={currentResponse === 'yes' ? 'eye' : 'eye-off-outline'}
          color={currentResponse === 'yes' ? Colors.accent.blue : Colors.text.secondary}
          accessibilityLabel={t.rehearsals.markSeen}
          accessibilityState={{ selected: currentResponse === 'yes', disabled: responding }}
          accessibilityValue={seenLabel ? { text: seenLabel } : undefined}
          style={styles.seenButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleSeen(rehearsal.id);
          }}
          disabled={responding}
        >
          {seenLabel && <Text style={styles.seenCount}>{seenLabel}</Text>}
        </IconButton>
      </View>
    </View>
  );

  // No swipe for anyone else: there is nothing behind it they may do.
  if (!isAdmin) return card;

  const renderActions = () => (
    <View style={styles.swipeActions}>
      <GestureTouchable
        testID="rehearsal-swipe-edit"
        style={[styles.swipeAction, styles.swipeActionEdit]}
        onPress={() => {
          swipeable.current?.close();
          navigation.navigate('AddRehearsal', {
            rehearsalId: rehearsal.id,
            projectId: rehearsal.projectId,
          });
        }}
      >
        <Ionicons name="create-outline" size={22} color={Colors.text.inverse} />
        <Text style={styles.swipeActionText}>{t.rehearsals.edit}</Text>
      </GestureTouchable>
      <GestureTouchable
        testID="rehearsal-swipe-delete"
        style={[styles.swipeAction, styles.swipeActionDelete]}
        onPress={() => {
          swipeable.current?.close();
          askToDelete(rehearsal);
        }}
      >
        <Ionicons name="trash-outline" size={22} color={Colors.text.inverse} />
        <Text style={styles.swipeActionText}>{t.common.delete}</Text>
      </GestureTouchable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeable}
      renderRightActions={renderActions}
      overshootRight={false}
      friction={2}
      // Two actions are twice the inbox's one, and half their width — the
      // default — took a swipe across half the screen to open them.
      rightThreshold={40}
      // Under the card's glass, so the actions do not show through it while it
      // slides; at rest it is the screen's own colour.
      childrenContainerStyle={styles.swipeCardUnder}
    >
      {card}
    </Swipeable>
  );
}
