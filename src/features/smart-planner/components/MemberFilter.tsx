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

interface MemberFilterProps {
  members: Member[];
  selected: string[];
  onSelectionChange: (memberIds: string[]) => void;
}

export const MemberFilter: React.FC<MemberFilterProps> = ({
  members,
  selected,
  onSelectionChange,
}) => {
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
      return 'Никто не выбран';
    }
    if (selected.length === members.length) {
      return 'Все участники';
    }
    return `Выбрано: ${selected.length}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.triggerText}>{getButtonText()}</Text>
        <ChevronDown size={16} color="#6b7280" />
      </TouchableOpacity>

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
              <Text style={styles.modalTitle}>Участники</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={selectAll}>
                <Text style={styles.actionBtnText}>Выбрать всех</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={clearAll}>
                <Text style={styles.actionBtnText}>Очистить</Text>
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
              <Text style={styles.applyButtonText}>Применить</Text>
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionBtnText: {
    fontSize: 14,
    color: '#3b82f6',
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
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#3b82f6',
  },
  memberName: {
    fontSize: 15,
    color: '#374151',
  },
  applyButton: {
    backgroundColor: '#3b82f6',
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
