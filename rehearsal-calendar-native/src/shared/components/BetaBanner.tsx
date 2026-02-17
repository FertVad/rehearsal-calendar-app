import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../contexts/I18nContext';
import { bugReportsAPI } from '../services/api';
import { Colors } from '../constants/colors';

export function BetaBanner() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      await bugReportsAPI.create({ message: message.trim() });
      setMessage('');
      setModalVisible(false);
      Alert.alert(t.common.success, t.betaBanner.bugReportSent);
    } catch {
      Alert.alert(t.common.error, 'Failed to send report');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <View style={[styles.banner, { paddingTop: insets.top + 4 }]}>
        <View style={styles.left}>
          <Ionicons name="rocket-outline" size={14} color={Colors.accent.purple} />
          <Text style={styles.title}>{t.betaBanner.title}</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
          <Ionicons name="bug-outline" size={13} color="#fff" />
          <Text style={styles.buttonText}>{t.betaBanner.bugReport}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.betaBanner.bugReport}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.betaBanner.bugReportPlaceholder}
              placeholderTextColor={Colors.text.tertiary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sendButton, (!message.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!message.trim() || sending}
            >
              <Text style={styles.sendButtonText}>
                {sending ? t.common.loading : t.betaBanner.send}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.bg.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent.purpleDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
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
