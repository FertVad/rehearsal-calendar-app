import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { ProjectMember } from '../../../shared/types';
import { useTimeRecommendations, TimeSlot } from '../hooks/useTimeRecommendations';
import { TimeRange } from '../../../shared/utils/availability';

interface TimeRecommendationsProps {
  selectedDate: string;
  selectedMembers: ProjectMember[];
  memberAvailability: Record<string, { timeRanges: TimeRange[] }>;
  onTimeSelect: (startTime: string, endTime: string) => void;
  loading?: boolean;
}

export const TimeRecommendations: React.FC<TimeRecommendationsProps> = ({
  selectedDate,
  selectedMembers,
  memberAvailability,
  onTimeSelect,
  loading = false,
}) => {
  const recommendations = useTimeRecommendations(
    selectedDate,
    selectedMembers,
    memberAvailability
  );

  const formatRecommendation = (rec: TimeSlot) => {
    if (rec.startTime === '00:00' && rec.endTime === '23:59') {
      return 'Весь день свободен';
    }
    const duration = rec.duration % 1 === 0 ? rec.duration : rec.duration.toFixed(1);
    return `${rec.startTime}-${rec.endTime} (${duration}ч)`;
  };

  if (!selectedDate || selectedMembers.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Рекомендованное время</Text>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Рекомендованное время</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Нет свободного времени для всех выбранных участников
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Рекомендованное время</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.slotsContainer}
        contentContainerStyle={styles.slotsContent}
      >
        {recommendations.map((rec) => (
          <TouchableOpacity
            key={`${rec.startTime}-${rec.endTime}`}
            style={[
              styles.slotButton,
              rec.confidence === 'high' ? styles.slotHigh : styles.slotMedium,
            ]}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  slotHigh: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: Colors.accent.purple,
  },
  slotMedium: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  slotText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
});
