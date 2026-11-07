import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Project, Rehearsal } from '../../../shared/types';
import { calendarScreenStyles as styles } from '../styles';
import RehearsalCard from './RehearsalCard';

interface RehearsalListProps {
  rehearsals: Rehearsal[];
  projects: Project[];
  /** The date column (T-036): the upcoming list, which runs over many days,
   *  has it; a day's own list, under a heading naming the day, does not. */
  withDates: boolean;
  /** Which are in the phone's calendar, by id. */
  synced?: Record<string, boolean>;
  onOpenRehearsal: (rehearsal: Rehearsal) => void;
}

/**
 * The calendar's rehearsals as rows on one rounded ground (T-036), the same in
 * "Upcoming Events" and in the day picked.
 *
 * The day is written in the column of its first rehearsal only; the next ones
 * of that day keep the column empty. A thin line 64 pt in parts the rows of
 * one day in either list, a line across the whole ground parts two days.
 */
export default function RehearsalList({
  rehearsals,
  projects,
  withDates,
  synced,
  onOpenRehearsal,
}: RehearsalListProps) {
  const projectsMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  return (
    <View style={styles.rehearsalList}>
      {rehearsals.map((rehearsal, index) => {
        const project = rehearsal.projectId ? projectsMap.get(rehearsal.projectId) : undefined;
        const previous = index > 0 ? rehearsals[index - 1] : undefined;
        // A day's own list is one day, a rehearsal begun the evening before
        // among them (DD02).
        const sameDay = !!previous && (!withDates || previous.date === rehearsal.date);

        return (
          <React.Fragment key={rehearsal.id}>
            {previous ? (
              <View
                testID={sameDay ? 'rehearsal-separator-day' : 'rehearsal-separator-days'}
                style={[
                  styles.rehearsalSeparator,
                  sameDay && styles.rehearsalSeparatorInset,
                ]}
              />
            ) : null}
            <RehearsalCard
              rehearsal={rehearsal}
              dateColumn={withDates ? (sameDay ? 'blank' : 'day') : undefined}
              projectName={project?.name || rehearsal.projectName}
              // Admin of this rehearsal's own project, not of any.
              isAdmin={project?.is_admin || false}
              isSynced={synced?.[rehearsal.id]}
              onPress={() => onOpenRehearsal(rehearsal)}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
}
