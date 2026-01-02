import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import type { Member } from '../types';
import { useI18n } from '../../../contexts/I18nContext';

interface MemberFilterProps {
  members: Member[];
  selected: string[];
  onSelectionChange: (memberIds: string[]) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

export const MemberFilter: React.FC<MemberFilterProps> = ({
  members,
  selected,
  onSelectionChange,
  onSelectAll,
  onClearAll,
}) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleMember = (memberId: string) => {
    if (selected.includes(memberId)) {
      onSelectionChange(selected.filter(id => id !== memberId));
    } else {
      onSelectionChange([...selected, memberId]);
    }
  };

  const toggleAll = () => {
    if (selected.length === members.length) {
      // Deselect all
      if (onClearAll) {
        onClearAll();
      } else {
        onSelectionChange([]);
      }
    } else {
      // Select all
      if (onSelectAll) {
        onSelectAll();
      } else {
        onSelectionChange(members.map(m => m.id));
      }
    }
  };

  const allSelected = selected.length === members.length && members.length > 0;

  if (members.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={Colors.text.tertiary} />
        <Text style={styles.emptyText}>{t.smartPlanner.noMembers || 'No members available'}</Text>
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
              {t.common.selectAll}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded ? (t.smartPlanner.collapse || 'Collapse') : (t.smartPlanner.expand || 'Expand')}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={Colors.text.secondary}
          />
        </TouchableOpacity>
      </View>

      {/* Selection Summary */}
      {selected.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {`${selected.length} ${t.smartPlanner.of || 'of'} ${members.length} ${t.smartPlanner.selected || 'selected'}`}
          </Text>
        </View>
      )}

      {/* Collapsible Members List */}
      {isExpanded && (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item.id);

            return (
              <TouchableOpacity
                style={[styles.memberItem, isSelected && styles.memberItemSelected]}
                onPress={() => toggleMember(item.id)}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={[styles.memberName, isSelected && styles.memberNameSelected]}>
                  {item.name}
                </Text>
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
  memberItem: {
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
  memberItemSelected: {
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
  memberName: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  memberNameSelected: {
    fontWeight: FontWeight.semibold,
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
});
