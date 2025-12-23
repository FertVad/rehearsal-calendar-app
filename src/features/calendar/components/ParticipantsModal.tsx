import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';

interface Participant {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  hasLiked: boolean;
  hasResponded: boolean;
}

interface ParticipantsModalProps {
  visible: boolean;
  onClose: () => void;
  participants: Participant[];
  totalCount: number;
  likedCount: number;
}

export const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
  visible,
  onClose,
  participants,
  totalCount,
  likedCount,
}) => {
  const { t } = useI18n();

  console.log('[ParticipantsModal] Rendering with:', {
    visible,
    participantsCount: participants.length,
    totalCount,
    likedCount,
    participants,
  });

  const renderParticipant = ({ item }: { item: Participant }) => {
    const displayName = `${item.firstName}${item.lastName ? ' ' + item.lastName : ''}`;

    // Determine icon and color based on response status
    let iconName: any;
    let iconColor: string;

    if (!item.hasResponded) {
      // No response yet - show help icon
      iconName = 'help-circle-outline';
      iconColor = Colors.text.tertiary;
    } else if (item.hasLiked) {
      // Liked - show filled heart
      iconName = 'heart';
      iconColor = Colors.accent.red;
    } else {
      // Responded but didn't like - show heart outline
      iconName = 'heart-outline';
      iconColor = Colors.text.tertiary;
    }

    return (
      <View style={styles.participantItem}>
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>{displayName}</Text>
          <Text style={styles.participantEmail}>{item.email}</Text>
        </View>
        <Ionicons
          name={iconName}
          size={20}
          color={iconColor}
        />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="people" size={24} color={Colors.accent.purple} />
              <Text style={styles.headerTitle}>
                {t.rehearsals.participants || 'Участники'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={16} color={Colors.accent.red} />
              <Text style={styles.statText}>
                {likedCount}/{totalCount}
              </Text>
            </View>
          </View>

          {/* Participants List */}
          <FlatList
            data={participants}
            keyExtractor={(item) => item.userId}
            renderItem={renderParticipant}
            style={styles.list}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    height: '80%',
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  stats: {
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.glass.bg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  statText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    marginBottom: Spacing.sm,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  participantEmail: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
});
