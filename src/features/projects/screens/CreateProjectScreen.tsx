import React, { useState } from 'react';
import {
  View,
  Text,
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
import { Colors } from '../../../shared/constants/colors';
import { ProjectsStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { createProjectScreenStyles as styles } from '../styles';

type CreateProjectScreenProps = NativeStackScreenProps<ProjectsStackParamList, 'CreateProject'>;

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
  const { t } = useI18n();
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
      Alert.alert(t.common.error, t.projects.nameRequired);
      return;
    }

    setCreating(true);
    try {
      await createProject(projectName.trim(), projectDescription.trim() || undefined, projectTimezone);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t.common.error, err.message || t.projects.createError);
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
          <Text style={styles.title}>{t.projects.createProject}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Project Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.projects.projectName}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.projects.namePlaceholder}
              placeholderTextColor={Colors.text.tertiary}
              value={projectName}
              onChangeText={setProjectName}
              autoFocus
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.projects.projectDescription} {t.auth.optional}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t.projects.descriptionPlaceholder}
              placeholderTextColor={Colors.text.tertiary}
              value={projectDescription}
              onChangeText={setProjectDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Timezone Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Timezone</Text>
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
            <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, creating && styles.buttonDisabled]}
            onPress={handleCreateProject}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>{t.projects.create}</Text>
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
              <Text style={styles.timezoneModalTitle}>Select Timezone</Text>
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
