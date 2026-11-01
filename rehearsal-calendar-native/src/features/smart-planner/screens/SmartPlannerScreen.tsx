import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { PlannerStackParamList, SmartPlannerNavigation } from '../../../navigation';
import { Colors } from '../../../shared/constants/colors';
import { IconButton } from '../../../shared/components/IconButton';
import type { SlotCategory, TimeSlot } from '../types';
import { useSmartPlanner } from '../hooks/useSmartPlanner';
import { DayCard } from '../components/DayCard';
import { ParticipantPicker } from '../../../shared/components/ParticipantPicker';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { DateRangePicker } from '../../../shared/components/DateRangePicker';
import { addDays, formatDateToString, parseDateString } from '../../../shared/utils/time';
import { formatDateRange } from '../../../shared/utils/clockFormat';
import { useToday } from '../../../shared/hooks/useClock';
import { memberAvailabilityLimits } from '../../../shared/utils/memberAvailabilityLimits';
import { canScheduleIn } from '../../../shared/utils/rehearsalRights';
import { smartPlannerScreenStyles as styles } from '../styles';

type Props = NativeStackScreenProps<PlannerStackParamList, 'SmartPlanner'>;

export default function SmartPlannerScreen({ route, navigation }: Props) {
  const appNavigation = useNavigation<SmartPlannerNavigation>();
  const { projectId } = route.params;
  const { projects } = useProjects();
  const { t, language } = useI18n();

  // Calendar dates of the profile's zone, written as every interval of dates
  // is: "29 окт. – 4 нояб." (clockFormat.ts).
  const formatPeriod = useCallback((startDate: string, endDate: string): string =>
    formatDateRange(startDate, endDate, getDateLocale(language)), [language]);

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'custom'>('week');
  const [selectedCategories] = useState<SlotCategory[]>([
    'perfect',
    'good',
    'ok',
    'bad',
  ]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  // Which filter's choice is open under the row; the participants' is a sheet.
  const [openChoice, setOpenChoice] = useState<'project' | 'period' | null>(null);

  // Today in the profile's zone: the planner's days are its days (cause fix 14).
  const today = useToday();

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<Date>(() => parseDateString(today));
  const [customEndDate, setCustomEndDate] = useState<Date>(() => parseDateString(addDays(today, 6)));
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  // Which project the current member selection was seeded for
  const hasInitializedMembers = useRef<string | null>(null);

  // Calculate date range based on selected period.
  //
  // Formatted from the local components, not through toISOString(): these Dates
  // carry a local wall clock, and in a zone ahead of UTC the UTC date is still
  // yesterday for the first hours after midnight. The range then began a day
  // early — offering slots on a day already past, tappable straight through to
  // scheduling a rehearsal in it — and lost its last day at the far end.
  const { startDate, endDate } = useMemo(() => {
    if (selectedPeriod === 'week') {
      return { startDate: today, endDate: addDays(today, 6) }; // 7 days total
    }
    if (selectedPeriod === 'month') {
      return { startDate: today, endDate: addDays(today, 29) }; // 30 days total
    }
    // custom period
    return {
      startDate: formatDateToString(customStartDate),
      endDate: formatDateToString(customEndDate),
    };
  }, [selectedPeriod, customStartDate, customEndDate, today]);

  // Load data using hook
  const {
    loading,
    error,
    project,
    simpleMembers,
    membersProjectId,
    membersWithoutData,
    filteredSlots,
    slotsByDate,
    refetch,
  } = useSmartPlanner({
    projectId,
    startDate,
    endDate,
    selectedCategories,
    selectedMemberIds,
  });

  // Refresh data when returning from AddRehearsal
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch])
  );

  const projectName = project?.name || t.common.loading;

  // Select everyone by default on first load per project; keep the selection
  // consistent with the roster on every subsequent reload.
  //
  // Two separate concerns live here:
  //
  // 1. Project switch (DP01). The project can change without this screen
  //    unmounting (handleSelectProject only calls setParams). When projectId
  //    changes, useSmartPlanner resets membersProjectId to null and starts a
  //    new load. Both the clearing effect (inside the hook) and this seeding
  //    effect fire in the same render batch — but simpleMembers in that batch
  //    still reflects the previous project's roster. The guard
  //    `membersProjectId !== projectId` prevents seeding from stale data by
  //    waiting until the hook confirms the members state is for the right
  //    project. On first confirmed load the full roster is selected.
  //
  // 2. Roster reload within the same project (R5-01). When the date range
  //    changes (period picker) the hook reloads without resetting
  //    membersProjectId. If a member was removed between loads their ID stays
  //    in selectedMemberIds; the slot generator receives an ID it cannot find
  //    in simpleMembers, counts it as a missing member, and may produce no
  //    usable slots. The reconciliation branch filters out IDs that are no
  //    longer present — without touching manual deselections for members that
  //    remain.
  useEffect(() => {
    if (membersProjectId !== projectId) return;

    const validIds = new Set(simpleMembers.map(m => m.id));

    if (hasInitializedMembers.current !== projectId) {
      // First confirmed load for this project: start with everyone selected.
      setSelectedMemberIds(simpleMembers.map(m => m.id));
      hasInitializedMembers.current = projectId;
      return;
    }

    // Same project, roster reloaded: drop IDs no longer in the project.
    setSelectedMemberIds(prev => {
      const next = prev.filter(id => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [simpleMembers, projectId, membersProjectId]);

  const handleSelectProject = useCallback((newProjectId: string) => {
    setOpenChoice(null);
    navigation.setParams({ projectId: newProjectId });
  }, [navigation]);

  const handleSelectPeriod = useCallback((period: 'week' | 'month') => {
    setOpenChoice(null);
    setSelectedPeriod(period);
  }, []);

  // "Select Dates" becomes the period once dates are picked in it, so Cancel
  // leaves the period it was. The segment chose 'custom' on the tap, and a
  // cancelled picker left it selected over the week's dates (T-012).
  const handleCustomPeriodClick = useCallback(() => {
    setOpenChoice(null);
    setShowDateRangePicker(true);
  }, []);

  const handleDateRangeConfirm = useCallback((start: Date, end: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setSelectedPeriod('custom');
  }, []);

  // A slot opens the form only for an admin of this project, the one person
  // the form can put a rehearsal in it for (T-012).
  const canSchedule = canScheduleIn(projects.find(p => p.id === projectId));
  const createRehearsal = useCallback((slot: TimeSlot) => {
    // AddRehearsal is on the app stack, above this tab. The slot is free time,
    // so it gives the start; the form ends it the usual length on (T-012).
    appNavigation.navigate('AddRehearsal', {
      projectId,
      prefilledDate: slot.date,
      prefilledTime: slot.startTime,
      // The slot is free for the people picked here, so the rehearsal starts
      // with them; none picked means everyone, as in the planner itself (DP02).
      prefilledMemberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
    });
  }, [appNavigation, projectId, selectedMemberIds]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-back"
          color={Colors.text.primary}
          accessibilityLabel={t.common.back}
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerSubtitle}>{t.smartPlanner.title}</Text>
        </View>
      </View>
    </View>
  );

  // The project, the period and the people, one row of 44 pt: "Hamlet ▾ ·
  // Week ▾ · Participants: all (4) ▾", each opening its own choice. Three
  // blocks of them took 232 pt, and the first recommendation began at y=435
  // of 852 (owner, 30.10.2026; T-020).
  const periodName = selectedPeriod === 'week'
    ? t.smartPlanner.week
    : selectedPeriod === 'month'
      ? t.smartPlanner.month
      : t.smartPlanner.customPeriod;
  const toggleChoice = (choice: 'project' | 'period') =>
    setOpenChoice(open => (open === choice ? null : choice));

  const renderOption = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    testID?: string,
  ) => (
    <TouchableOpacity
      key={key}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark" size={18} color={Colors.accent.purple} />}
    </TouchableOpacity>
  );

  const renderProjectChoice = () => (
    <View style={styles.choice}>
      {projects.filter(p => p.is_admin).map(proj => renderOption(
        proj.id, proj.name, proj.id === projectId, () => handleSelectProject(proj.id),
      ))}
    </View>
  );

  // "Select Dates" opens the dates, and becomes the period once they are picked.
  const renderPeriodChoice = () => (
    <View style={styles.choice}>
      {renderOption('week', t.smartPlanner.week, selectedPeriod === 'week',
        () => handleSelectPeriod('week'), 'planner-period-week')}
      {renderOption('month', t.smartPlanner.month, selectedPeriod === 'month',
        () => handleSelectPeriod('month'), 'planner-period-month')}
      {renderOption('custom', t.smartPlanner.custom, selectedPeriod === 'custom',
        handleCustomPeriodClick, 'planner-period-custom')}
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View testID="planner-filters" style={styles.filters}>
        <TouchableOpacity
          testID="planner-project"
          style={styles.filter}
          onPress={() => toggleChoice('project')}
        >
          <Text style={styles.filterText} numberOfLines={1}>{projectName}</Text>
          <Ionicons
            name={openChoice === 'project' ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.text.secondary}
          />
        </TouchableOpacity>
        <Text style={styles.filterDot}>·</Text>
        <TouchableOpacity
          testID="planner-period"
          style={styles.filter}
          onPress={() => toggleChoice('period')}
        >
          <Text style={styles.filterText} numberOfLines={1}>{periodName}</Text>
          <Ionicons
            name={openChoice === 'period' ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.text.secondary}
          />
        </TouchableOpacity>
        <Text style={styles.filterDot}>·</Text>
        {/* Nobody picked is everyone here: the planner weighs the whole roster. */}
        <ParticipantPicker
          chip
          people={simpleMembers}
          selectedIds={selectedMemberIds}
          onChange={setSelectedMemberIds}
          noneLabel={t.smartPlanner.allMembers}
        />
      </View>
      {openChoice === 'project' && renderProjectChoice()}
      {openChoice === 'period' && renderPeriodChoice()}
    </View>
  );

  // The dates the period covers, beside "Recommendations": the row names only
  // the period.
  const renderListTitle = () => (
    <View style={styles.listTitle}>
      <Text style={styles.listTitleText}>{t.smartPlanner.recommendations}</Text>
      <Text style={styles.periodDate}>{formatPeriod(startDate, endDate)}</Text>
    </View>
  );

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
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <DateRangePicker
        visible={showDateRangePicker}
        onClose={() => setShowDateRangePicker(false)}
        onConfirm={handleDateRangeConfirm}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
        minDate={parseDateString(today)}
        maxDays={memberAvailabilityLimits.maxDays}
      />
      {/* The participants sheet is inside it for React's touches, overlay or
          not: by default a tap on the sheet with its search's keyboard up
          only put the keyboard away, a person found took two (T-010). */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderFilters()}
        {renderListTitle()}

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
          <View>
            {/* Someone with no availability rows counts as free in every slot,
                so a project where nobody has entered anything reports itself as
                Perfect. Naming them is the difference between a recommendation
                and a guess. */}
            {membersWithoutData.length > 0 && (
              <Text style={styles.unknownNote}>
                {t.smartPlanner.unknownAvailability(membersWithoutData.join(', '))}
              </Text>
            )}
            {Array.from(slotsByDate.entries()).map(([date, slots]) => (
              <DayCard
                key={date}
                date={date}
                slots={slots}
                onCreateRehearsal={canSchedule ? createRehearsal : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
