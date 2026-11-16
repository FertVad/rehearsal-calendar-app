import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../../../shared/constants/colors';
import { ProjectMember } from '../../../shared/types';
import { useTimeRecommendations, FreeWindow } from '../hooks/useTimeRecommendations';
import { TimeRange } from '../../../shared/utils/availability';
import { useI18n } from '../../../contexts/I18nContext';
import { formatTimeRange, usePhoneUses24HourClock } from '../../../shared/utils/clockFormat';
import { getDateLocale } from '../../../shared/utils/locale';

interface TimeRecommendationsProps {
  selectedDate: string;
  selectedMembers: ProjectMember[];
  memberAvailability: Record<string, { timeRanges: TimeRange[] }>;
  /**
   * A window of free time: its start is the rehearsal's, its end how far the
   * rehearsal may run before someone is busy (T-012, T-238).
   */
  onTimeSelect: (startTime: string, freeUntil: string) => void;
  loading?: boolean;
}

export const TimeRecommendations: React.FC<TimeRecommendationsProps> = ({
  selectedDate,
  selectedMembers,
  memberAvailability,
  onTimeSelect,
  loading = false,
}) => {
  const { t, language } = useI18n();
  const uses24 = usePhoneUses24HourClock();
  const { freeAllDay, windows: recommendations } = useTimeRecommendations(
    selectedDate,
    selectedMembers,
    memberAvailability
  );

  const formatRecommendation = (rec: FreeWindow) => {
    const duration = rec.duration % 1 === 0 ? rec.duration : rec.duration.toFixed(1);
    return `${formatTimeRange(rec.startTime, rec.endTime, getDateLocale(language), uses24)} (${duration}${t.rehearsals.hoursShort})`;
  };

  if (!selectedDate || selectedMembers.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t.rehearsals.recommendedTime}</Text>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t.calendar.loading}</Text>
        </View>
      </View>
    );
  }

  // A day with nobody busy has no window to tap: 09:00–23:00 is the working
  // day, not a rehearsal. A line says so, and the time is the form's (T-238).
  if (freeAllDay || recommendations.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t.rehearsals.recommendedTime}</Text>
        <View style={styles.emptyContainer}>
          <Text testID="recommendations-note" style={styles.emptyText}>
            {freeAllDay ? t.rehearsals.everyoneFreeAllDay : t.rehearsals.noAvailableTime}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.rehearsals.recommendedTime}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.slotsContainer}
        contentContainerStyle={styles.slotsContent}
      >
        {/* Each window is time everyone picked is free: green, the colour
            of free (colors.ts, T-031). */}
        {recommendations.map((rec) => (
          <TouchableOpacity
            key={`${rec.startTime}-${rec.endTime}`}
            testID={`recommendation-${rec.startTime}`}
            style={styles.slotButton}
            onPress={() => onTimeSelect(rec.startTime, rec.endTime)}
          >
            <Text style={styles.slotText}>{formatRecommendation(rec)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  loadingContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
  },
  emptyContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  slotsContainer: {
    flexGrow: 0,
  },
  slotsContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  slotButton: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    backgroundColor: Colors.accent.greenAlpha15,
    borderColor: Colors.accent.green,
  },
  slotText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
});
