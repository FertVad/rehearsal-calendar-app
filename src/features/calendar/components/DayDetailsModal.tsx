import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { Rehearsal, ResponseStats } from '../../../shared/types';
import { formatDateLocalized } from '../../../shared/utils/time';
import { rehearsalsAPI } from '../../../shared/services/api';
import { useI18n } from '../../../contexts/I18nContext';

interface DayDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  date: string;
  rehearsals: Rehearsal[];
  onDeleteRehearsal?: (rehearsalId: string) => void;
  isAdmin?: boolean;
}

export default function DayDetailsModal({
  visible,
  onClose,
  date,
  rehearsals,
  onDeleteRehearsal,
  isAdmin = false,
}: DayDetailsModalProps) {
  const { t, language } = useI18n();
  const [statsMap, setStatsMap] = useState<Record<string, ResponseStats>>({});
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});

  const formatTime = (time: string) => {
    return time.substring(0, 5); // Remove seconds if present
  };

  // Fetch stats for rehearsals when modal opens (only for admin)
  useEffect(() => {
    if (visible && isAdmin && rehearsals.length > 0) {
      rehearsals.forEach(async (rehearsal) => {
        if (!statsMap[rehearsal.id]) {
          setLoadingStats(prev => ({ ...prev, [rehearsal.id]: true }));
          try {
            const response = await rehearsalsAPI.getResponses(rehearsal.id);
            setStatsMap(prev => ({ ...prev, [rehearsal.id]: response.data.stats }));
          } catch (err) {
            console.error('Failed to fetch stats:', err);
          } finally {
            setLoadingStats(prev => ({ ...prev, [rehearsal.id]: false }));
          }
        }
      });
    }
  }, [visible, isAdmin, rehearsals]);

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
              <Text style={styles.title}>{formatDateLocalized(date, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }, language === 'ru' ? 'ru-RU' : 'en-US')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {rehearsals.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyText}>{t.calendar.noRehearsals}</Text>
              </View>
            ) : (
              <View style={styles.rehearsalsList}>
                <Text style={styles.sectionTitle}>
                  {t.calendar.rehearsalsCount(rehearsals.length)}
                </Text>
                {rehearsals.map((rehearsal) => (
                  <View key={rehearsal.id} style={styles.rehearsalCard}>
                    <View style={styles.timeContainer}>
                      <View style={styles.timeIndicator} />
                      <Text style={styles.timeText}>
                        {formatTime(rehearsal.time || '')}
                      </Text>
                      {rehearsal.endTime && (
                        <Text style={styles.durationText}>
                          — {formatTime(rehearsal.endTime)}
                        </Text>
                      )}
                    </View>

                    <View style={styles.rehearsalDetails}>
                      <View style={styles.rehearsalHeader}>
                        <Text style={styles.sceneText}>
                          {rehearsal.location || t.calendar.rehearsal}
                        </Text>
                        {isAdmin && onDeleteRehearsal && (
                          <TouchableOpacity
                            onPress={() => onDeleteRehearsal(rehearsal.id)}
                            style={styles.deleteButton}
                          >
                            <Ionicons name="trash-outline" size={18} color={Colors.accent.red} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {rehearsal.projectName && (
                        <View style={styles.actorsContainer}>
                          <Ionicons name="folder-outline" size={14} color={Colors.text.secondary} />
                          <Text style={styles.actorsText}>
                            {rehearsal.projectName}
                          </Text>
                        </View>
                      )}

                      {/* Admin Stats */}
                      {isAdmin && (
                        <View style={styles.statsContainer}>
                          {loadingStats[rehearsal.id] ? (
                            <ActivityIndicator size="small" color={Colors.accent.purple} />
                          ) : statsMap[rehearsal.id] && statsMap[rehearsal.id].total > 0 ? (
                            <View style={styles.statsRow}>
                              <View style={styles.statItem}>
                                <Ionicons name="heart" size={14} color={Colors.accent.red} />
                                <Text style={styles.statText}>{statsMap[rehearsal.id].confirmed}</Text>
                              </View>
                              <View style={styles.statItem}>
                                <Ionicons name="help-circle" size={14} color={Colors.text.tertiary} />
                                <Text style={styles.statText}>{statsMap[rehearsal.id].invited}</Text>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
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
    minHeight: '40%',
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
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    textTransform: 'capitalize',
    flex: 1,
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
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  rehearsalsList: {
    padding: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  rehearsalCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  timeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.purple,
    marginRight: Spacing.sm,
  },
  timeText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  durationText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    marginLeft: Spacing.sm,
  },
  rehearsalDetails: {
    paddingLeft: Spacing.md + 8, // Align with text after indicator
  },
  rehearsalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sceneText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
    flex: 1,
    marginBottom: Spacing.xs,
  },
  deleteButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  actorsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  actorsText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    flex: 1,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  notesText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    flex: 1,
  },
  statsContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
});
