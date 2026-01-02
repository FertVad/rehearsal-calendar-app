import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlannerStackParamList } from '../../../navigation';
import { Colors } from '../../../shared/constants/colors';
import type { SlotCategory } from '../types';
import { useSmartPlanner } from '../hooks/useSmartPlanner';
import { DayCard } from '../components/DayCard';
import { MemberFilter } from '../components/MemberFilter';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { DateRangePicker } from '../../../shared/components/DateRangePicker';
import { smartPlannerScreenStyles as styles } from '../styles';

type Props = NativeStackScreenProps<PlannerStackParamList, 'SmartPlanner'>;

export default function SmartPlannerScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { projects } = useProjects();
  const { t, language } = useI18n();

  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    const options: Intl.DateTimeFormatOptions = { month: 'short' };

    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = start.toLocaleDateString(locale, options);
    const endMonth = end.toLocaleDateString(locale, options);

    if (start.getMonth() === end.getMonth()) {
      return `${startDay}-${endDay} ${startMonth}`;
    }

    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  };

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'custom'>('week');
  const [selectedCategories] = useState<SlotCategory[]>([
    'perfect',
    'good',
    'ok',
  ]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isProjectSelectorExpanded, setIsProjectSelectorExpanded] = useState(false);

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 6);
    return date;
  });
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  // Track if members have been initially loaded
  const hasInitializedMembers = useRef(false);

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
    slotsByDate,
  } = useSmartPlanner({
    projectId,
    startDate,
    endDate,
    selectedCategories,
    selectedMemberIds,
  });

  const projectName = project?.name || 'Loading...';

  // Auto-select all members when they load (only on first load)
  useEffect(() => {
    if (simpleMembers.length > 0 && !hasInitializedMembers.current) {
      setSelectedMemberIds(simpleMembers.map(m => m.id));
      hasInitializedMembers.current = true;
    }
  }, [simpleMembers]);

  const handleSelectProject = useCallback((newProjectId: string) => {
    setIsProjectSelectorExpanded(false);
    navigation.setParams({ projectId: newProjectId });
  }, [navigation]);

  const handleDateRangeConfirm = useCallback((start: Date, end: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  }, []);

  const handleCustomPeriodClick = useCallback(() => {
    setSelectedPeriod('custom');
    setShowDateRangePicker(true);
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
          <Text style={styles.headerSubtitle}>{t.smartPlanner.title}</Text>
        </View>
      </View>
    </SafeAreaView>
  );

  const renderProjectSelector = () => (
    <View style={styles.projectSelectorContainer}>
      <TouchableOpacity
        style={styles.projectSelectorButton}
        onPress={() => setIsProjectSelectorExpanded(!isProjectSelectorExpanded)}
      >
        <Ionicons name="folder-outline" size={18} color={Colors.accent.purple} />
        <Text style={styles.projectSelectorText}>{projectName}</Text>
        <Ionicons
          name={isProjectSelectorExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.text.secondary}
        />
      </TouchableOpacity>

      {isProjectSelectorExpanded && (
        <View style={styles.projectDropdown}>
          {projects.filter(p => p.is_admin).map(proj => (
            <TouchableOpacity
              key={proj.id}
              style={[
                styles.projectOption,
                proj.id === projectId && styles.projectOptionSelected
              ]}
              onPress={() => handleSelectProject(proj.id)}
            >
              <Text style={[
                styles.projectOptionText,
                proj.id === projectId && styles.projectOptionTextSelected
              ]}>
                {proj.name}
              </Text>
              {proj.id === projectId && (
                <Ionicons name="checkmark" size={18} color={Colors.accent.purple} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderPeriodSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.smartPlanner.period}</Text>
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
            {t.smartPlanner.week}
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
            {t.smartPlanner.month}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === 'custom' && styles.periodButtonActive,
          ]}
          onPress={handleCustomPeriodClick}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === 'custom' && styles.periodButtonTextActive,
            ]}
          >
            {t.smartPlanner.custom}
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

  const renderMemberFilter = () => {
    const selectAll = () => {
      setSelectedMemberIds(simpleMembers.map(m => m.id));
    };
    const clearAll = () => {
      setSelectedMemberIds([]);
    };
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.smartPlanner.members}</Text>
        <MemberFilter
          members={simpleMembers}
          selected={selectedMemberIds}
          onSelectionChange={setSelectedMemberIds}
          onSelectAll={selectAll}
          onClearAll={clearAll}
        />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="calendar-outline"
        size={64}
        color={Colors.text.tertiary}
      />
      <Text style={styles.emptyStateTitle}>{t.smartPlanner.noSlots}</Text>
      <Text style={styles.emptyStateText}>
        {t.smartPlanner.noSlotsMessage}
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
      <Text style={styles.emptyStateTitle}>{t.smartPlanner.errorLoading}</Text>
      <Text style={styles.emptyStateText}>{error}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
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
        {renderProjectSelector()}
        {renderPeriodSelector()}
        {renderMemberFilter()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent.purple} />
            <Text style={styles.loadingText}>{t.smartPlanner.analyzing}</Text>
          </View>
        ) : error ? (
          renderError()
        ) : filteredSlots.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.slotsContainer}>
            <Text style={styles.sectionTitle}>{t.smartPlanner.recommendations}</Text>
            {Array.from(slotsByDate.entries()).map(([date, slots]) => (
              <DayCard
                key={date}
                date={date}
                slots={slots}
                onCreateRehearsal={(slot) => {
                  // Navigate to Calendar tab -> AddRehearsal with prefilled data
                  // @ts-ignore - Navigate to parent tab navigator
                  navigation.navigate('Calendar', {
                    screen: 'AddRehearsal',
                    params: {
                      projectId,
                      prefilledDate: slot.date,
                      prefilledTime: slot.startTime,
                      prefilledEndTime: slot.endTime,
                    },
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
