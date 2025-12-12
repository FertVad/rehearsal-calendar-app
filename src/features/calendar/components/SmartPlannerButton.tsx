import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
import { calendarScreenStyles as styles } from '../styles';

interface Project {
  id: string;
  name: string;
  is_admin: boolean;
  updatedAt?: string;
  createdAt?: string;
}

interface SmartPlannerButtonProps {
  adminProjects: Project[];
  onPress: (projectId: string) => void;
}

export default function SmartPlannerButton({
  adminProjects,
  onPress,
}: SmartPlannerButtonProps) {
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
          <Text style={styles.smartPlannerTitle}>Smart Planner</Text>
          <Text style={styles.smartPlannerSubtitle}>
            Найти оптимальное время для репетиции
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}
