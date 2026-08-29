import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../../shared/constants/colors';
import { Rehearsal, Project } from '../../../shared/types';
import { formatDateLocalized, formatDateToString } from '../../../shared/utils/time';
import { calendarScreenStyles as styles } from '../styles';
import { useI18n } from '../../../contexts/I18nContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { isRehearsalSynced } from '../../../shared/utils/calendarStorage';
import RehearsalCard from './RehearsalCard';

interface TodayRehearsalsProps {
  rehearsals: Rehearsal[];
  selectedDate: string;
  loading: boolean;
  projects: Project[];
  onDeleteRehearsal: (rehearsalId: string) => void;
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
  onDeleteRehearsal,
  onOpenRehearsal,
}: TodayRehearsalsProps) {
  const { t, language } = useI18n();
  const navigation = useNavigation<any>();
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
  const dateLabel = useMemo(() => {
    const today = formatDateToString(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateToString(tomorrow);

    if (selectedDate === today) return t.common.today;
    if (selectedDate === tomorrowStr) return t.calendar.tomorrow;
    const locale = getDateLocale(language);
    return formatDateLocalized(selectedDate, { day: 'numeric', month: 'long', weekday: 'long' }, locale);
  }, [selectedDate, t, language]);

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

  if (rehearsals.length === 0) {
    return (
      <View style={styles.todaySection}>
        <Text style={styles.sectionTitle}>{dateLabel}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t.calendar.noRehearsals}</Text>
        </View>
      </View>
    );
  }

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
              onDelete={onDeleteRehearsal}
            />
          );
        })}
      </View>

    </View>
  );
}
