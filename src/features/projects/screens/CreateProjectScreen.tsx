import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';
import { AppStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';

type CreateProjectScreenProps = NativeStackScreenProps<AppStackParamList, 'CreateProject'>;

// Common timezones for theatre/rehearsal apps
const TIMEZONES = [
  { value: 'Asia/Jerusalem', label: 'Тель-Авив (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Europe/Berlin', label: 'Берлин (UTC+1)' },
  { value: 'Europe/London', label: 'Лондон (UTC+0)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8)' },
];

export default function CreateProjectScreen({ navigation }: CreateProjectScreenProps) {
  const { createProject } = useProjects();
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectTimezone, setProjectTimezone] = useState('Asia/Jerusalem');
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  const getTimezoneLabel = (value: string) => {
    const tz = TIMEZONES.find(t => t.value === value);
    return tz?.label || value;
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      Alert.alert('Ошибка', 'Введите название проекта');
      return;
    }

    setCreating(true);
    try {
      await createProject(projectName.trim(), projectDescription.trim() || undefined, projectTimezone);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось создать проект');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Новый проект</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Project Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Название проекта</Text>
            <TextInput
              style={styles.input}
              placeholder="Введите название"
              placeholderTextColor={Colors.text.tertiary}
              value={projectName}
              onChangeText={setProjectName}
              autoFocus
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Описание (необязательно)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Введите описание"
              placeholderTextColor={Colors.text.tertiary}
              value={projectDescription}
              onChangeText={setProjectDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Timezone Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Часовой пояс</Text>
            <TouchableOpacity
              style={styles.timezoneSelector}
              activeOpacity={0.7}
              onPress={() => setTimezonePickerVisible(true)}
            >
              <View style={styles.timezoneSelectorLeft}>
                <Ionicons name="globe" size={20} color={Colors.accent.blue} />
                <Text style={styles.timezoneSelectorValue}>
                  {getTimezoneLabel(projectTimezone)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Buttons */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, creating && styles.buttonDisabled]}
            onPress={handleCreateProject}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Создать</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Timezone Picker Modal */}
      <Modal
        visible={timezonePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimezonePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.timezoneModalOverlay}
          activeOpacity={1}
          onPress={() => setTimezonePickerVisible(false)}
        >
          <View style={styles.timezoneModalContent}>
            <View style={styles.timezoneModalHeader}>
              <Text style={styles.timezoneModalTitle}>Выберите часовой пояс</Text>
              <TouchableOpacity onPress={() => setTimezonePickerVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={TIMEZONES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.timezoneItem,
                    projectTimezone === item.value && styles.timezoneItemSelected,
                  ]}
                  onPress={() => {
                    setProjectTimezone(item.value);
                    setTimezonePickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.timezoneLabel,
                      projectTimezone === item.value && styles.timezoneLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {projectTimezone === item.value && (
                    <Ionicons name="checkmark" size={20} color={Colors.accent.purple} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.timezoneList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  backButton: {
    padding: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  input: {
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  timezoneSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  timezoneSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  timezoneSelectorValue: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  createButton: {
    flex: 1,
    backgroundColor: Colors.accent.purple,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Timezone picker modal styles
  timezoneModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  timezoneModalContent: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
  },
  timezoneModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  timezoneModalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  timezoneList: {
    paddingBottom: Spacing.xxl,
  },
  timezoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.md,
  },
  timezoneItemSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  timezoneLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  timezoneLabelSelected: {
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
});
