import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { ProjectMember } from '../../../shared/types';

interface ActorSelectorProps {
  members: ProjectMember[];
  selectedMemberIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  loading?: boolean;
  date?: string;
  memberAvailability?: Record<string, { timeRanges: { start: string; end: string }[] }>;
}

export const ActorSelector: React.FC<ActorSelectorProps> = ({
  members,
  selectedMemberIds,
  onSelectionChange,
  loading = false,
  date,
  memberAvailability = {},
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const toggleMember = (memberId: string) => {
    const isSelected = selectedMemberIds.includes(memberId);
    const newSelection = isSelected
      ? selectedMemberIds.filter(id => id !== memberId)
      : [...selectedMemberIds, memberId];

    onSelectionChange(newSelection);
  };

  const getAvailabilityStatus = (userId: string): { status: 'available' | 'partial' | 'busy'; ranges: { start: string; end: string }[] } => {
    if (!date) return { status: 'available', ranges: [] };
    const ranges = memberAvailability[userId]?.timeRanges || [];

    if (ranges.length === 0) {
      return { status: 'available', ranges: [] };
    }

    const isFullDay = ranges.length === 1 &&
                      ranges[0].start === '00:00' &&
                      (ranges[0].end === '23:59' || ranges[0].end === '24:00');

    return {
      status: isFullDay ? 'busy' : 'partial',
      ranges: ranges,
    };
  };

  const formatTimeRange = (start: string, end: string): string => {
    return `${start}-${end}`;
  };

  const toggleAll = () => {
    if (selectedMemberIds.length === members.length) {
      // Deselect all
      onSelectionChange([]);
    } else {
      // Select all
      onSelectionChange(members.map(member => member.userId));
    }
  };

  const allSelected = selectedMemberIds.length === members.length && members.length > 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка участников...</Text>
      </View>
    );
  }

  if (members.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={Colors.text.tertiary} />
        <Text style={styles.emptyText}>Нет участников в проекте</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Select All and Expand/Collapse */}
      <View style={styles.header}>
        {members.length > 1 && (
          <TouchableOpacity style={styles.selectAllButton} onPress={toggleAll}>
            <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
              {allSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={styles.selectAllText}>
              {allSelected ? 'Снять выделение' : 'Выбрать всех'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded ? 'Свернуть' : 'Развернуть'}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={Colors.text.secondary}
          />
        </TouchableOpacity>
      </View>

      {/* Selection Summary */}
      {selectedMemberIds.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            Выбрано: {selectedMemberIds.length} из {members.length}
          </Text>
        </View>
      )}

      {/* Collapsible Members List */}
      {isExpanded && (
        <FlatList
          data={members}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => {
            const isSelected = selectedMemberIds.includes(item.userId);
            const displayName = `${item.firstName}${item.lastName ? ' ' + item.lastName : ''}`;
            const isAdmin = item.role === 'owner' || item.role === 'admin';

            const availability = getAvailabilityStatus(item.userId);

            return (
              <TouchableOpacity
                style={[styles.actorItem, isSelected && styles.actorItemSelected]}
                onPress={() => toggleMember(item.userId)}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={styles.actorInfo}>
                  <View style={styles.actorHeader}>
                    <Text style={[styles.actorName, isSelected && styles.actorNameSelected]}>
                      {displayName}
                    </Text>
                    {isAdmin && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Админ</Text>
                      </View>
                    )}
                  </View>
                  {date && (
                    <View style={styles.availabilityContainer}>
                      {availability.status === 'available' && (
                        <View style={[styles.statusChip, styles.statusAvailable]}>
                          <Text style={styles.statusText}>Свободен</Text>
                        </View>
                      )}
                      {availability.status === 'busy' && (
                        <View style={[styles.statusChip, styles.statusBusy]}>
                          <Text style={styles.statusText}>Занят весь день</Text>
                        </View>
                      )}
                      {availability.status === 'partial' && availability.ranges.map((range, idx) => (
                        <View key={`${range.start}-${range.end}-${idx}`} style={[styles.statusChip, styles.statusPartial]}>
                          <Text style={styles.statusText}>Занят {formatTimeRange(range.start, range.end)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          style={styles.list}
          scrollEnabled={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.tertiary,
  },
  selectAllButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.xs,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  expandButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  selectAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
  list: {
    maxHeight: 300,
  },
  actorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  actorItemSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: Colors.accent.purple,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent.purple,
    borderColor: Colors.accent.purple,
  },
  actorInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: Spacing.xs,
  },
  actorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actorName: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  actorNameSelected: {
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  adminBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  adminBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
  summary: {
    padding: Spacing.sm,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  summaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  availabilityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  statusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusAvailable: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusBusy: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusPartial: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
});
