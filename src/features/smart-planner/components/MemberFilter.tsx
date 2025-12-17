import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
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
  const [isOpen, setIsOpen] = useState(false);

  const toggleMember = (memberId: string) => {
    if (selected.includes(memberId)) {
      onSelectionChange(selected.filter(id => id !== memberId));
    } else {
      onSelectionChange([...selected, memberId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(members.map(m => m.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const getButtonText = () => {
    if (selected.length === 0) {
      return t.smartPlanner.noneSelected;
    }
    if (selected.length === members.length) {
      return t.smartPlanner.allMembers;
    }
    return `${t.smartPlanner.selectedMembers}: ${selected.length}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.trigger}
          onPress={() => setIsOpen(true)}
        >
          <Text style={styles.triggerText}>{getButtonText()}</Text>
          <ChevronDown size={16} color="#9ca3af" />
        </TouchableOpacity>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={onSelectAll || selectAll}
          >
            <Text style={styles.quickActionText}>{t.smartPlanner.selectAll}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={onClearAll || clearAll}
          >
            <Text style={styles.quickActionText}>{t.smartPlanner.clearAll}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsOpen(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.smartPlanner.selectMembers}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={selectAll}>
                <Text style={styles.actionBtnText}>{t.common.selectAll}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={clearAll}>
                <Text style={styles.actionBtnText}>{t.common.clear}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.list}>
              {members.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.item}
                  onPress={() => toggleMember(member.id)}
                >
                  <View style={styles.checkbox}>
                    {selected.includes(member.id) && (
                      <View style={styles.checkboxChecked} />
                    )}
                  </View>
                  <Text style={styles.memberName}>{member.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setIsOpen(false)}
            >
              <Text style={styles.applyButtonText}>{t.smartPlanner.applyFilter}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  trigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerText: {
    fontSize: 14,
    color: '#f9fafb',
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 4,
  },
  quickActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(147, 51, 234, 0.3)',
    borderRadius: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#9333ea',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  closeButton: {
    fontSize: 24,
    color: '#9ca3af',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionBtnText: {
    fontSize: 14,
    color: '#9333ea',
    fontWeight: '600',
  },
  list: {
    maxHeight: 300,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#9333ea',
  },
  memberName: {
    fontSize: 15,
    color: '#f9fafb',
  },
  applyButton: {
    backgroundColor: '#9333ea',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
