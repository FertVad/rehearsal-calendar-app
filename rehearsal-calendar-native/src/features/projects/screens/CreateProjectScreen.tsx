import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { IconButton } from '../../../shared/components/IconButton';
import { hapticSuccess } from '../../../shared/utils/haptics';
import { AppStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../contexts/I18nContext';
import { createProjectScreenStyles as styles } from '../styles';
import { AppModal } from '../../../shared/components/AppModal';
import { ModalSheet } from '../../../shared/components/ModalSheet';
import { BottomActionBar, BottomActionButton } from '../../../shared/components/BottomActionBar';
import { useIdempotencyKey } from '../../../shared/hooks/useIdempotencyKey';

type CreateProjectScreenProps = NativeStackScreenProps<AppStackParamList, 'CreateProject'>;

import { getTimezonesWithDevice, getTimezoneLabel as getTzLabel } from '../../../shared/constants/timezones';

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
  const idempotency = useIdempotencyKey();

  const getTimezoneLabel = (value: string) => getTzLabel(value, language);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      Alert.alert(t.common.error, t.projects.nameRequired);
      return;
    }

    setCreating(true);
    try {
      const name = projectName.trim();
      const description = projectDescription.trim() || undefined;
      // The same form sent again after a lost answer gets the project the
      // first try made, not a second one (useIdempotencyKey).
      const newProject = await createProject(
        idempotency.keyFor({ name, description, projectTimezone }),
        name,
        description,
        projectTimezone,
      );
      idempotency.settle();

      // Close the modal and drop the user straight into the new project
      // so they can invite members / set up rehearsals without an extra tap.
      // `pop: true` goes back to the MainTabs under the form; without it a
      // copy was pushed over the form, and swiping the project away showed the
      // form again (T-007). `initial: false` puts the project over the list
      // when the Projects tab has not been opened yet, so back is the list.
      navigation.navigate('MainTabs', {
        screen: 'Projects',
        params: {
          screen: 'ProjectDetail',
          params: { projectId: newProject.id },
          initial: false,
        },
      }, { pop: true });
    } catch (err: any) {
      Alert.alert(t.common.error, err.message || t.projects.createError);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* The buttons are in the bar below, which keeps them over the keyboard
          (T-009). */}
      <SafeAreaView style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="chevron-back" color={Colors.text.primary} accessibilityLabel={t.common.back} onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t.projects.createProject}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
      </SafeAreaView>

      <BottomActionBar>
        <BottomActionButton
          variant="secondary"
          label={t.common.cancel}
          onPress={() => navigation.goBack()}
        />
        <BottomActionButton
          label={t.projects.create}
          onPress={() => {
            hapticSuccess();
            handleCreateProject();
          }}
          loading={creating}
        />
      </BottomActionBar>

      {/* Timezone Picker Modal */}
      <AppModal
        visible={timezonePickerVisible}
        animationType="slide"
        onRequestClose={() => setTimezonePickerVisible(false)}
      >
        <ModalSheet overlayStyle={styles.timezoneModalOverlay} onClose={() => setTimezonePickerVisible(false)}>
          <View style={styles.timezoneModalContent}>
            <View style={styles.timezoneModalHeader}>
              <Text style={styles.timezoneModalTitle}>{t.projects.selectTimezone}</Text>
              <IconButton icon="close" accessibilityLabel={t.common.close} onPress={() => setTimezonePickerVisible(false)} />
            </View>
            <FlatList
              data={getTimezonesWithDevice()}
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
        </ModalSheet>
      </AppModal>
    </View>
  );
}
