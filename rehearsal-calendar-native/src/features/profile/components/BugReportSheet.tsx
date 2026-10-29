import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../../contexts/I18nContext';
import { bugReportsAPI } from '../../../shared/services/api';
import { Colors } from '../../../shared/constants/colors';
import { AppModal } from '../../../shared/components/AppModal';

// The bug report, sent from the profile. It was a "Test Flight" banner over
// every tab until the owner took the banner out (T-008, 29.10.2026); the
// report is always sent from here, so its screen is the profile.
export function BugReportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      await bugReportsAPI.create({ message: message.trim(), screen: 'Profile' });
      setMessage('');
      onClose();
      Alert.alert(t.common.success, t.profile.reportBugSent);
    } catch {
      Alert.alert(t.common.error, 'Failed to send report');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppModal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.profile.reportBug}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t.common.close} onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <TextInput
            testID="bug-report-message"
            style={styles.input}
            placeholder={t.profile.reportBugPlaceholder}
            placeholderTextColor={Colors.text.tertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            autoFocus
          />
          <TouchableOpacity
            testID="bug-report-send"
            style={[styles.sendButton, (!message.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!message.trim() || sending}
          >
            <Text style={styles.sendButtonText}>
              {sending ? t.common.loading : t.profile.reportBugSend}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    padding: 14,
    color: Colors.text.primary,
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: Colors.accent.purple,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
