import React, { useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GlassButton } from '../../../shared/components';
import TelegramLoginWebView from './TelegramLoginWebView';
import { useI18n } from '../../../contexts/I18nContext';
import { Colors, FontSize } from '../../../shared/constants/colors';

interface TelegramLoginButtonProps {
  style?: any;
  mode?: 'login' | 'register';
}

// Bot username (without @)
const BOT_USERNAME = 'rehearsal_calendar_bot';

export default function TelegramLoginButton({ style, mode = 'login' }: TelegramLoginButtonProps) {
  const [showWebView, setShowWebView] = useState(false);
  const { t } = useI18n();

  const handlePress = () => {
    setShowWebView(true);
  };

  return (
    <>
      <GlassButton
        title={mode === 'login' ? t.auth.loginWithTelegram : t.auth.registerWithTelegram}
        onPress={handlePress}
        variant="glass"
        style={style}
      />

      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWebView(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setShowWebView(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TelegramLoginWebView
            botName={BOT_USERNAME}
            onClose={() => setShowWebView(false)}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: Colors.bg.primary,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: '300',
  },
});
