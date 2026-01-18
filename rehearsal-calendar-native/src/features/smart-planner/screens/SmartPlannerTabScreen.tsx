import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PlannerStackParamList } from '../../../navigation';
import { useProjects } from '../../../contexts/ProjectContext';
import { Colors } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';

type NavigationProp = NativeStackNavigationProp<PlannerStackParamList, 'PlannerMain'>;

export default function SmartPlannerTabScreen() {
  const { projects, loading } = useProjects();
  const { t } = useI18n();
  const navigation = useNavigation<NavigationProp>();
  const hasNavigated = useRef(false);

  useEffect(() => {
    // If there are projects, replace this screen with SmartPlanner (prevent back navigation loop)
    if (!loading && projects.length > 0 && !hasNavigated.current) {
      hasNavigated.current = true;
      const firstProject = projects[0];
      // Use replace instead of navigate to prevent infinite loop when swiping back
      navigation.replace('SmartPlanner', { projectId: firstProject.id });
    }
  }, [loading, projects, navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.accent.purple} />
      </View>
    );
  }

  if (projects.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          {t.projects.noProjects}
        </Text>
        <Text style={styles.hintText}>
          {t.projects.createToUsePlanner}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.accent.purple} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
