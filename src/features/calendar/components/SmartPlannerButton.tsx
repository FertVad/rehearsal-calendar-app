import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { calendarScreenStyles as styles } from '../styles';
import { useI18n } from '../../../contexts/I18nContext';
import { Project } from '../../../shared/types';

interface SmartPlannerButtonProps {
  adminProjects: Project[];
  onPress: (projectId: string) => void;
}

export default function SmartPlannerButton({
  adminProjects,
  onPress,
}: SmartPlannerButtonProps) {
  const { t } = useI18n();

  if (adminProjects.length === 0) {
    return null;
  }

  const handlePress = () => {
    // Get the most recent admin project
    const sortedProjects = [...adminProjects].sort((a, b) => {
      const dateA = new Date((a as any).updatedAt || (a as any).createdAt || 0);
      const dateB = new Date((b as any).updatedAt || (b as any).createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    const defaultProject = sortedProjects[0];
    onPress(defaultProject.id);
  };

  return (
    <View style={styles.smartPlannerContainer}>
      <TouchableOpacity
        style={styles.smartPlannerButton}
        onPress={handlePress}
      >
        <View style={styles.smartPlannerIconContainer}>
          <Ionicons name="bulb" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.smartPlannerTextContainer}>
          <Text style={styles.smartPlannerTitle}>{t.smartPlanner.title}</Text>
          <Text style={styles.smartPlannerSubtitle}>
            {t.calendar.smartPlannerSubtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}
