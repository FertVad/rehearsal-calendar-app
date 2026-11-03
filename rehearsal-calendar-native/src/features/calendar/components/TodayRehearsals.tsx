import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Colors } from '../../../shared/constants/colors';
import { Rehearsal, Project } from '../../../shared/types';
import { addDays } from '../../../shared/utils/time';
import { useToday } from '../../../shared/hooks/useClock';
import { calendarScreenStyles as styles } from '../styles';
import { useI18n } from '../../../contexts/I18nContext';
import { formatDate } from '../../../shared/utils/dateFormat';
import { isRehearsalSynced } from '../../../shared/utils/calendarStorage';
import RehearsalCard from './RehearsalCard';

interface TodayRehearsalsProps {
  rehearsals: Rehearsal[];
  selectedDate: string;
  loading: boolean;
  projects: Project[];
  /** Opening the details sheet belongs to the calendar. This component used to
   *  render its own, which meant two of them on one screen with separate state:
   *  a sheet opened from here was invisible to the code that opens one for a
   *  tapped notification, so the second was presented over the first and iOS
   *  kept a layer that ate every touch. */
  onOpenRehearsal: (rehearsal: Rehearsal) => void;
}

export default function TodayRehearsals({
  rehearsals,
  selectedDate,
  loading,
  projects,
  onOpenRehearsal,
}: TodayRehearsalsProps) {
  const { t, language } = useI18n();
  const [syncedRehearsals, setSyncedRehearsals] = useState<Record<string, boolean>>({});

  // Memoize project lookup to avoid repeated searches (MUST be before early returns!)
  const projectsMap = useMemo(() => {
    return new Map(projects.map(p => [p.id, p]));
  }, [projects]);

  // Check which rehearsals are synced to calendar
  // Memoize rehearsal IDs to avoid re-running when rehearsal content changes
  const rehearsalIds = useMemo(() => rehearsals.map(r => r.id).join(','), [rehearsals]);

  useEffect(() => {
    const checkSyncStatus = async () => {
      const syncStatus: Record<string, boolean> = {};
      await Promise.all(
        rehearsals.map(async (rehearsal) => {
          const isSynced = await isRehearsalSynced(rehearsal.id);
          syncStatus[rehearsal.id] = isSynced;
        })
      );
      setSyncedRehearsals(syncStatus);
    };

    if (rehearsals.length > 0) {
      checkSyncStatus();
    }
  }, [rehearsalIds, rehearsals]);

  // Get date label (Сегодня, Завтра, or formatted date)
  const today = useToday();
  const dateLabel = useMemo(() => {
    if (selectedDate === today) return t.common.today;
    if (selectedDate === addDays(today, 1)) return t.calendar.tomorrow;
    return formatDate(selectedDate, 'weekdayDayMonth', language);
  }, [selectedDate, today, t, language]);

  if (loading) {
    return (
      <View style={styles.todaySection}>
        <Text style={styles.sectionTitle}>{dateLabel}</Text>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
        </View>
      </View>
    );
  }

  // A day with none takes no room (T-019): its title and "Nothing today" were
  // 98 pt, and the strip already shows the day has no count. The upcoming
  // list under it stays.
  if (rehearsals.length === 0) return null;

  return (
    <View style={styles.todaySection}>
      <Text style={styles.sectionTitle}>{dateLabel}</Text>
      <View style={styles.todayList}>
        {rehearsals.map((rehearsal) => {
          const project = rehearsal.projectId ? projectsMap.get(rehearsal.projectId) : undefined;
          const isAdminForThisRehearsal = project?.is_admin || false;

          return (
            <RehearsalCard
              key={rehearsal.id}
              rehearsal={rehearsal}
              projectName={project?.name || rehearsal.projectName}
              isAdmin={isAdminForThisRehearsal}
              isSynced={syncedRehearsals[rehearsal.id]}
              onPress={() => onOpenRehearsal(rehearsal)}
            />
          );
        })}
      </View>

    </View>
  );
}
