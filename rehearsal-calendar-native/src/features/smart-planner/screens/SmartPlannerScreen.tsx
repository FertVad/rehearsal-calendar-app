import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { PlannerStackParamList, SmartPlannerNavigation } from '../../../navigation';
import { Colors } from '../../../shared/constants/colors';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import type { SlotCategory, TimeSlot } from '../types';
import { useSmartPlanner } from '../hooks/useSmartPlanner';
import { DayCard } from '../components/DayCard';
import { ParticipantPicker } from '../../../shared/components/ParticipantPicker';
import { useProjects } from '../../../contexts/ProjectContext';
import { useI18n } from '../../../contexts/I18nContext';
import { DateRangePicker } from '../../../shared/components/DateRangePicker';
import { addDays, formatDateToString, parseDateString } from '../../../shared/utils/time';
import { formatDateRange } from '../../../shared/utils/dateFormat';
import { useToday } from '../../../shared/hooks/useClock';
import { memberAvailabilityLimits } from '../../../shared/utils/memberAvailabilityLimits';
import { canScheduleIn } from '../../../shared/utils/rehearsalRights';
import { smartPlannerScreenStyles as styles } from '../styles';

type Props = NativeStackScreenProps<PlannerStackParamList, 'SmartPlanner'>;

/**
 * The Planner tab's first and only screen: a large title, as the other tabs
 * have, and nothing to go back to (owner, 04.11; T-032). It was a screen
 * pushed over a placeholder that replaced itself with it, with a "←" that led
 * out of the tab to the calendar and a small grey "Smart Planner" for a title.
 *
 * The project is the one asked for — the calendar's "Smart Planner", a choice
 * in the row — or, opened from the tab, the first one, set in the params once
 * so that it stays the same while the list of projects changes.
 */
export default function SmartPlannerScreen({ route, navigation }: Props) {
  const { projects, loading } = useProjects();
  const { t } = useI18n();
  const projectId = route.params?.projectId;
  const firstProjectId = projects[0]?.id;

  useEffect(() => {
    if (!projectId && firstProjectId) navigation.setParams({ projectId: firstProjectId });
  }, [projectId, firstProjectId, navigation]);

  const selectProject = useCallback((id: string) => {
    navigation.setParams({ projectId: id });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader kind="root" title={t.nav.planner} />
      {projectId ? (
        <PlannerBody projectId={projectId} onSelectProject={selectProject} />
      ) : loading || firstProjectId ? (
        <View style={styles.noProject}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
        </View>
      ) : (
        <View style={styles.noProject}>
          <Text style={styles.noProjectTitle}>{t.smartPlanner.title}</Text>
          <Text style={styles.noProjectText}>{t.projects.createToUsePlanner}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function PlannerBody({ projectId, onSelectProject }: {
  projectId: string;
  onSelectProject: (projectId: string) => void;
}) {
  const appNavigation = useNavigation<SmartPlannerNavigation>();
  const { projects } = useProjects();
  const { t, language } = useI18n();

  // Calendar dates of the profile's zone, written as every interval of dates
  // is: "29 окт. – 4 нояб." (dateFormat.ts).
  const formatPeriod = useCallback((startDate: string, endDate: string): string =>
    formatDateRange(startDate, endDate, language), [language]);

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'custom'>('week');
  const [selectedCategories] = useState<SlotCategory[]>([
    'perfect',
    'good',
    'ok',
    'bad',
  ]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  // The projects' choice, open under the project's name; the participants' is a sheet.
  const [projectChoiceOpen, setProjectChoiceOpen] = useState(false);

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
    setProjectChoiceOpen(false);
    onSelectProject(newProjectId);
  }, [onSelectProject]);

  // "Dates" becomes the period once dates are picked in it, so Cancel leaves
  // the segment that was. It chose 'custom' on the tap, and a cancelled picker
  // left it selected over the week's dates (T-012).
  const handleCustomPeriodClick = useCallback(() => {
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
    // so it gives the start; the form ends it the usual length on (T-012), or
    // sooner, when the first of those free at the start is busy (T-238).
    appNavigation.navigate('AddRehearsal', {
      projectId,
      prefilledDate: slot.date,
      prefilledTime: slot.startTime,
      prefilledFreeUntil: slot.freeUntil,
      // The slot is free for the people picked here, so the rehearsal starts
      // with them; none picked means everyone, as in the planner itself (DP02).
      prefilledMemberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
    });
  }, [appNavigation, projectId, selectedMemberIds]);

  // The project, the period and the people, one under another (owner, 09.11;
  // T-241). In one row of 44 pt (T-020) each had a third of it, and all three
  // were cut in every language: «Шоу-балет «…» · «Нед…» · «Участ…все (8)»,
  // "Compañía…" · "Sem…".
  //
  // The projects to choose from are the ones this person runs. With none but
  // this one there is nothing to choose: its name, and no chevron.
  const canChooseProject = projects.some(p => p.is_admin && p.id !== projectId);
  const periods = [
    ['week', t.smartPlanner.week],
    ['month', t.smartPlanner.month],
    ['custom', t.smartPlanner.dates],
  ] as const;

  // The dates beside "Recommendations" are the days in the list: the period
  // began with today, and today's hours gone, the list began with tomorrow —
  // "8 nov – 14 nov" over "Lun, 9 nov". With no day in it, the period's.
  const listDays = useMemo(() => Array.from(slotsByDate.keys()).sort(), [slotsByDate]);
  const showsDays = !loading && !error && listDays.length > 0;
  const titleStart = showsDays ? listDays[0] : startDate;
  const titleEnd = showsDays ? listDays[listDays.length - 1] : endDate;

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
      // The name alone: without it iOS reads the checkmark's glyph into it.
      accessibilityLabel={label}
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

  // The project's name in the colour of doing, as long as it is: two lines
  // and a third before it ends in "…".
  const renderProject = () => (canChooseProject ? (
    <TouchableOpacity
      testID="planner-project"
      style={styles.project}
      onPress={() => setProjectChoiceOpen(open => !open)}
      accessibilityRole="button"
      // What it is and which: without a label iOS reads the chevron's glyph
      // into it, and the name alone is the option's in the choice under it.
      accessibilityLabel={`${t.rehearsals.project}, ${projectName}`}
      accessibilityState={{ expanded: projectChoiceOpen }}
    >
      <Text style={styles.projectName} numberOfLines={3}>{projectName}</Text>
      <Ionicons
        testID="planner-project-chevron"
        name={projectChoiceOpen ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={Colors.accent.purple}
      />
    </TouchableOpacity>
  ) : (
    <View
      testID="planner-project"
      style={styles.project}
      accessible
      accessibilityLabel={`${t.rehearsals.project}, ${projectName}`}
    >
      <Text style={[styles.projectName, styles.projectNameOnly]} numberOfLines={3}>{projectName}</Text>
    </View>
  ));

  // Three equal segments, the one picked always in sight; Week and Month a
  // tap each, Dates its picker.
  const renderPeriod = () => (
    <View testID="planner-period" style={styles.segments}>
      {periods.map(([period, label]) => {
        const selected = selectedPeriod === period;
        return (
          <TouchableOpacity
            key={period}
            testID={`planner-period-${period}`}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={period === 'custom' ? handleCustomPeriodClick : () => setSelectedPeriod(period)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFilters = () => (
    <View testID="planner-filters" style={styles.filters}>
      {renderProject()}
      {projectChoiceOpen && renderProjectChoice()}
      {renderPeriod()}
      {/* Nobody picked is everyone here: the planner weighs the whole roster. */}
      <ParticipantPicker
        faces
        people={simpleMembers}
        selectedIds={selectedMemberIds}
        onChange={setSelectedMemberIds}
        noneLabel={t.smartPlanner.allMembers}
      />
    </View>
  );

  const renderListTitle = () => (
    <View style={styles.listTitle}>
      <Text style={styles.listTitleText}>{t.smartPlanner.recommendations}</Text>
      <Text testID="planner-list-dates" style={styles.periodDate}>{formatPeriod(titleStart, titleEnd)}</Text>
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
    <>
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
    </>
  );
}
