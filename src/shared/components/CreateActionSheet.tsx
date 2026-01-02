import React, { useEffect, useRef } from 'react';
import { ActionSheetIOS, Platform, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useI18n } from '../../contexts/I18nContext';
import { Colors } from '../constants/colors';

interface CreateActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreateRehearsal: () => void;
  onMarkBusy: () => void;
  onCreateProject: () => void;
}

export const CreateActionSheet: React.FC<CreateActionSheetProps> = ({
  visible,
  onClose,
  onCreateRehearsal,
  onMarkBusy,
  onCreateProject,
}) => {
  const { t } = useI18n();
  const isShowingRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'ios' && visible && !isShowingRef.current) {
      isShowingRef.current = true;

      // Сразу вызываем onClose, чтобы сбросить флаг visible
      onClose();

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t.common.cancel,
            t.actionSheet.createRehearsal,
            t.actionSheet.markBusy,
            t.actionSheet.createProject,
          ],
          cancelButtonIndex: 0,
          userInterfaceStyle: 'dark',
        },
        (buttonIndex) => {
          isShowingRef.current = false;

          if (buttonIndex === 1) {
            onCreateRehearsal();
          } else if (buttonIndex === 2) {
            onMarkBusy();
          } else if (buttonIndex === 3) {
            onCreateProject();
          }
        }
      );
    } else if (!visible) {
      isShowingRef.current = false;
    }
  }, [visible, onClose, onCreateRehearsal, onMarkBusy, onCreateProject, t]);

  const handleAction = (action: 'rehearsal' | 'busy' | 'project') => {
    switch (action) {
      case 'rehearsal':
        onCreateRehearsal();
        break;
      case 'busy':
        onMarkBusy();
        break;
      case 'project':
        onCreateProject();
        break;
    }
  };

  if (Platform.OS === 'ios') {
    return null;
  }

  // Android fallback with Modal
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{t.actionSheet.title}</Text>

            <TouchableOpacity
              style={styles.option}
              onPress={() => handleAction('rehearsal')}
            >
              <Text style={styles.optionText}>{t.actionSheet.createRehearsal}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() => handleAction('busy')}
            >
              <Text style={styles.optionText}>{t.actionSheet.markBusy}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() => handleAction('project')}
            >
              <Text style={styles.optionText}>{t.actionSheet.createProject}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, styles.cancelOption]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: Colors.glass.border,
  },
  title: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  option: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  optionText: {
    fontSize: 18,
    color: Colors.accent.purple,
    textAlign: 'center',
    fontWeight: '500',
  },
  cancelOption: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 18,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
