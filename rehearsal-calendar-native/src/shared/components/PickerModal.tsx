import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../constants/colors';
import { useI18n } from '../../contexts/I18nContext';
import { usePickerDraft } from '../hooks/usePickerDraft';
import { AppModal } from './AppModal';
import { ModalSheet } from './ModalSheet';

interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  value: Date;
  /** Called with the picked value on Done — never on Cancel (usePickerDraft). */
  onConfirm: (value: Date) => void;
  mode: 'date' | 'time';
  title: string;
  language?: string;
}

export const PickerModal: React.FC<PickerModalProps> = ({
  visible,
  onClose,
  value,
  onConfirm,
  mode,
  title,
  language = 'en-US',
}) => {
  const { t } = useI18n();
  const picker = usePickerDraft({ visible, value, onConfirm, onClose });

  // Android uses native modal, no custom UI needed
  if (Platform.OS === 'android' && visible) {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        onChange={picker.change}
        is24Hour={mode === 'time'}
        locale={language}
        themeVariant="dark"
        textColor={Colors.text.primary}
      />
    );
  }

  // iOS custom modal with bottom sheet
  if (Platform.OS === 'ios') {
    return (
      <AppModal visible={visible} animationType="slide" onRequestClose={picker.cancel}>
        <ModalSheet overlayStyle={styles.overlay} onClose={picker.cancel}>
          <View style={styles.modalContent}>
            {/* Header with Cancel and Done buttons */}
            <View style={styles.header}>
              <TouchableOpacity onPress={picker.cancel} style={styles.headerButton}>
                <Text style={styles.cancelButton}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={picker.confirm} style={styles.headerButton}>
                <Text style={styles.doneButton}>{t.common.done}</Text>
              </TouchableOpacity>
            </View>

            {/* Picker */}
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={picker.draft}
                mode={mode}
                display="spinner"
                onChange={picker.change}
                is24Hour={mode === 'time'}
                locale={language}
                themeVariant="dark"
                textColor={Colors.text.primary}
                style={styles.picker}
              />
            </View>
          </View>
        </ModalSheet>
      </AppModal>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  // Cancel and Done are words, but the tap is taken on 44 pt; the header's
  // padding went into them.
  headerButton: {
    minWidth: TouchTarget,
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  cancelButton: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  doneButton: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  pickerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    height: 216,
    width: '100%',
  },
});
