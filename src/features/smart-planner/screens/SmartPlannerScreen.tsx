import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../../navigation';
import { Colors } from '../../../shared/constants/colors';
import type { SlotCategory } from '../types';
import { useSmartPlanner } from '../hooks/useSmartPlanner';
import { DayCard } from '../components/DayCard';
import { MemberFilter } from '../components/MemberFilter';
import { useProjects } from '../../../contexts/ProjectContext';
import { DateRangePicker } from '../../../shared/components/DateRangePicker';
import { smartPlannerScreenStyles as styles } from '../styles';

type Props = NativeStackScreenProps<AppStackParamList, 'SmartPlanner'>;

const CATEGORY_CONFIG: Record<
  SlotCategory,
  { emoji: string; color: string; label: string }
> = {
  perfect: { emoji: '🟢', color: '#10b981', label: 'Идеально' },
  good: { emoji: '🟡', color: '#fbbf24', label: 'Хорошо' },
  ok: { emoji: '🟠', color: '#f97316', label: 'Норм' },
  bad: { emoji: '🔴', color: '#ef4444', label: 'Плохо' },
};

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = months[start.getMonth()];
  const endMonth = months[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startDay}-${endDay} ${startMonth}`;
  }

  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

export default function SmartPlannerScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { projects } = useProjects();

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'custom'>('week');
  const [selectedCategories, setSelectedCategories] = useState<SlotCategory[]>([
    'perfect',
    'good',
    'ok',
  ]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 6);
    return date;
  });
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  // Calculate date range based on selected period
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);

    if (selectedPeriod === 'week') {
      end.setDate(end.getDate() + 6); // 7 days total
    } else if (selectedPeriod === 'month') {
      end.setDate(end.getDate() + 29); // 30 days total
    } else {
      // custom period
      return {
        startDate: customStartDate.toISOString().split('T')[0],
        endDate: customEndDate.toISOString().split('T')[0],
      };
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Load data using hook
  const {
    loading,
    error,
    project,
    simpleMembers,
    filteredSlots,
    categoryCounts,
    slotsByDate,
  } = useSmartPlanner({
    projectId,
    startDate,
    endDate,
    selectedCategories,
    selectedMemberIds,
  });

  const projectName = project?.name || 'Loading...';

  // Auto-select all members when they load
  useEffect(() => {
    if (simpleMembers.length > 0 && selectedMemberIds.length === 0) {
      setSelectedMemberIds(simpleMembers.map(m => m.id));
    }
  }, [simpleMembers, selectedMemberIds.length]);

  const toggleCategory = useCallback((category: SlotCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);

  const handleSelectProject = useCallback((newProjectId: string) => {
    setIsProjectModalOpen(false);
    navigation.setParams({ projectId: newProjectId });
  }, [navigation]);

  const handleDateRangeConfirm = useCallback((start: Date, end: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  }, []);

  const renderHeader = () => (
    <SafeAreaView edges={['top']} style={styles.headerContainer}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {projectName}
          </Text>
          <Text style={styles.headerSubtitle}>Smart Planner</Text>
        </View>
        <TouchableOpacity
          style={styles.changeProjectButton}
          onPress={() => setIsProjectModalOpen(true)}
        >
          <Text style={styles.changeProjectText}>Сменить</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const renderProjectModal = () => (
    <Modal
      visible={isProjectModalOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setIsProjectModalOpen(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setIsProjectModalOpen(false)}
      >
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Выбрать проект</Text>
            <TouchableOpacity onPress={() => setIsProjectModalOpen(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.projectList}>
            {projects.filter(p => p.is_admin).map(proj => (
              <TouchableOpacity
                key={proj.id}
                style={[
                  styles.projectItem,
                  proj.id === projectId && styles.projectItemSelected,
                ]}
                onPress={() => handleSelectProject(proj.id)}
              >
                <Text style={[
                  styles.projectName,
                  proj.id === projectId && styles.projectNameSelected,
                ]}>
                  {proj.name}
                </Text>
                {proj.id === projectId && (
                  <Ionicons name="checkmark" size={20} color={Colors.accent.purple} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderPeriodSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📅 Период</Text>
      <View style={styles.periodButtons}>
        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === 'week' && styles.periodButtonActive,
          ]}
          onPress={() => setSelectedPeriod('week')}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === 'week' && styles.periodButtonTextActive,
            ]}
          >
            Неделя
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === 'month' && styles.periodButtonActive,
          ]}
          onPress={() => setSelectedPeriod('month')}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === 'month' && styles.periodButtonTextActive,
            ]}
          >
            Месяц
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === 'custom' && styles.periodButtonActive,
          ]}
          onPress={() => setSelectedPeriod('custom')}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === 'custom' && styles.periodButtonTextActive,
            ]}
          >
            Свой
          </Text>
        </TouchableOpacity>
      </View>

      {selectedPeriod === 'custom' ? (
        <TouchableOpacity
          style={styles.customDateButton}
          onPress={() => setShowDateRangePicker(true)}
        >
          <Text style={styles.customDateText}>
            {formatDateRange(startDate, endDate)}
          </Text>
          <Ionicons name="calendar-outline" size={20} color={Colors.accent.purple} />
        </TouchableOpacity>
      ) : (
        <Text style={styles.periodDate}>
          {formatDateRange(startDate, endDate)}
        </Text>
      )}
    </View>
  );

  const renderCategoryFilters = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Категории</Text>
      <View style={styles.categoryGrid}>
        {(Object.entries(CATEGORY_CONFIG) as [SlotCategory, typeof CATEGORY_CONFIG[SlotCategory]][]).map(
          ([category, config]) => {
            const isSelected = selectedCategories.includes(category);
            const count = categoryCounts[category];

            return (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  isSelected && { borderColor: config.color },
                ]}
                onPress={() => toggleCategory(category)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryEmoji}>{config.emoji}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && { color: config.color },
                  ]}
                >
                  {config.label}
                </Text>
                <Text style={styles.categoryCount}>{count}</Text>
              </TouchableOpacity>
            );
          }
        )}
      </View>
    </View>
  );

  const renderMemberFilter = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>👥 Участники</Text>
      <MemberFilter
        members={simpleMembers}
        selected={selectedMemberIds}
        onSelectionChange={setSelectedMemberIds}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="calendar-outline"
        size={64}
        color={Colors.text.tertiary}
      />
      <Text style={styles.emptyStateTitle}>Нет доступных слотов</Text>
      <Text style={styles.emptyStateText}>
        Попробуйте изменить период или выбрать другие категории
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="alert-circle-outline"
        size={64}
        color={Colors.accent.red}
      />
      <Text style={styles.emptyStateTitle}>Ошибка загрузки</Text>
      <Text style={styles.emptyStateText}>{error}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderProjectModal()}
      <DateRangePicker
        visible={showDateRangePicker}
        onClose={() => setShowDateRangePicker(false)}
        onConfirm={handleDateRangeConfirm}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
        minDate={new Date()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {renderPeriodSelector()}
        {renderCategoryFilters()}
        {renderMemberFilter()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent.purple} />
            <Text style={styles.loadingText}>Анализируем доступность...</Text>
          </View>
        ) : error ? (
          renderError()
        ) : filteredSlots.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.slotsContainer}>
            <Text style={styles.sectionTitle}>Рекомендации</Text>
            {Array.from(slotsByDate.entries()).map(([date, slots]) => (
              <DayCard
                key={date}
                date={date}
                slots={slots}
                onCreateRehearsal={(slot) => {
                  // Navigate to AddRehearsal with prefilled data
                  navigation.navigate('AddRehearsal', {
                    projectId,
                    prefilledDate: slot.date,
                    prefilledTime: slot.startTime,
                    prefilledEndTime: slot.endTime,
                  });
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
