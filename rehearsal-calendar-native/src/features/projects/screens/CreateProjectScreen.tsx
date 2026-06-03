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
import { hapticSuccess } from '../../../shared/utils/haptics';
import { AppStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { createProjectScreenStyles as styles } from '../styles';

type CreateProjectScreenProps = NativeStackScreenProps<AppStackParamList, 'CreateProject'>;

import { TIMEZONES, getTimezoneLabel as getTzLabel } from '../../../shared/constants/timezones';

export default function CreateProjectScreen({ navigation }: CreateProjectScreenProps) {
  const { createProject } = useProjects();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectTimezone, setProjectTimezone] = useState(
    user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem'
  );
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  const getTimezoneLabel = (value: string) => getTzLabel(value, language);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      Alert.alert(t.common.error, t.projects.nameRequired);
      return;
    }

    setCreating(true);
    try {
      await createProject(projectName.trim(), projectDescription.trim() || undefined, projectTimezone);
      // Simply go back to close the modal
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
            <Text style={styles.label}>{t.projects.timezone}</Text>
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

          {/* Buttons */}
          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createButton, creating && styles.buttonDisabled]}
              onPress={() => {
                hapticSuccess();
                handleCreateProject();
              }}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>{t.projects.create}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
              <Text style={styles.timezoneModalTitle}>{t.projects.selectTimezone}</Text>
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
                    {language === 'ru' ? item.labelRu : item.labelEn}
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
