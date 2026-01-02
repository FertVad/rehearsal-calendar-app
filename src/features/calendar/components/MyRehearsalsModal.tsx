import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { isRehearsalSynced } from '../../../shared/utils/calendarStorage';
import { useI18n } from '../../../contexts/I18nContext';

interface MyRehearsalsModalProps {
  visible: boolean;
  onClose: () => void;
  rehearsals: Rehearsal[];
  onSelectDate?: (date: string) => void;
}

export default function MyRehearsalsModal({
  visible,
  onClose,
  rehearsals,
  onSelectDate,
}: MyRehearsalsModalProps) {
  const { t, language } = useI18n();
  const [syncedRehearsals, setSyncedRehearsals] = useState<Record<string, boolean>>({});

  // Get upcoming rehearsals sorted by date
  const upcomingRehearsals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    return rehearsals
      .filter(r => r.date && r.date >= todayStr)
      .sort((a, b) => {
        if (a.date && b.date && a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        return 0;
      });
  }, [rehearsals]);

  // Check which rehearsals are synced to calendar
  useEffect(() => {
    const checkSyncStatus = async () => {
      const syncStatus: Record<string, boolean> = {};
      for (const rehearsal of upcomingRehearsals) {
        const isSynced = await isRehearsalSynced(rehearsal.id);
        syncStatus[rehearsal.id] = isSynced;
      }
      setSyncedRehearsals(syncStatus);
    };

    if (upcomingRehearsals.length > 0 && visible) {
      checkSyncStatus();
    }
  }, [upcomingRehearsals, visible]);

  // Group rehearsals by date
  const groupedRehearsals = useMemo(() => {
    const groups: { [key: string]: Rehearsal[] } = {};

    upcomingRehearsals.forEach(rehearsal => {
      const date = rehearsal.date || '';
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(rehearsal);
    });

    return groups;
  }, [upcomingRehearsals]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.getTime() === today.getTime()) {
      return t.common.today;
    } else if (d.getTime() === tomorrow.getTime()) {
      return t.calendar.tomorrow;
    }

    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    return d.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const handleRehearsalPress = (date: string) => {
    onSelectDate?.(date);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerHandle} />
            <View style={styles.headerContent}>
              <Text style={styles.title}>{t.calendar.myRehearsals}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {upcomingRehearsals.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyTitle}>{t.rehearsals.noUpcoming}</Text>
                <Text style={styles.emptyText}>
                  {t.rehearsals.willAppear}
                </Text>
              </View>
            ) : (
              <View style={styles.rehearsalsList}>
                <Text style={styles.subtitle}>
                  {t.calendar.upcomingCount(upcomingRehearsals.length)}
                </Text>

                {Object.entries(groupedRehearsals).map(([date, dateRehearsals]) => (
                  <View key={date} style={styles.dateGroup}>
                    <Text style={styles.dateHeader}>{formatDate(date)}</Text>

                    {dateRehearsals.map((rehearsal) => (
                      <TouchableOpacity
                        key={rehearsal.id}
                        style={styles.rehearsalCard}
                        onPress={() => handleRehearsalPress(date)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.timeContainer}>
                          <View style={styles.timeIndicator} />
                          <Text style={styles.timeText}>
                            {formatTime(rehearsal.time || '')}
                          </Text>
                          {rehearsal.duration && (
                            <Text style={styles.durationText}>
                              ({rehearsal.duration})
                            </Text>
                          )}
                          {syncedRehearsals[rehearsal.id] && (
                            <Ionicons name="calendar" size={12} color={Colors.accent.green} style={{ marginLeft: 4 }} />
                          )}
                        </View>

                        <View style={styles.rehearsalDetails}>
                          <Text style={styles.sceneText}>{rehearsal.scene}</Text>

                          {rehearsal.actorNameSnapshot && rehearsal.actorNameSnapshot.length > 0 && (
                            <View style={styles.actorsContainer}>
                              <Ionicons name="people-outline" size={12} color={Colors.text.tertiary} />
                              <Text style={styles.actorsText} numberOfLines={1}>
                                {rehearsal.actorNameSnapshot.join(', ')}
                              </Text>
                            </View>
                          )}
                        </View>

                        <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  headerHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.glass.border,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
    width: '100%',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  rehearsalsList: {
    padding: Spacing.xl,
  },
  subtitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  dateGroup: {
    marginBottom: Spacing.lg,
  },
  dateHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  rehearsalCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
    minWidth: 80,
  },
  timeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.purple,
    marginRight: Spacing.xs,
  },
  timeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  durationText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginLeft: 4,
  },
  rehearsalDetails: {
    flex: 1,
  },
  sceneText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  actorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actorsText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    flex: 1,
  },
});
