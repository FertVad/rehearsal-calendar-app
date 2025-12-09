import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing } from '../../../shared/constants/colors';
import { Rehearsal, Project } from '../../../shared/types';

interface StatsPanelProps {
  rehearsals: Rehearsal[];
  adminProjects: Project[];
  adminStats: Record<string, { confirmed: number; declined: number; pending: number }>;
  filterProjectId: string | null;
}

export default function StatsPanel({
  rehearsals,
  adminProjects,
  adminStats,
  filterProjectId
}: StatsPanelProps) {
  // Calculate aggregated statistics
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter rehearsals for current month
    const monthlyRehearsals = rehearsals.filter(r => {
      const date = new Date(r.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // Filter only admin projects' rehearsals
    const adminProjectIds = adminProjects.map(p => p.id);
    const adminRehearsals = filterProjectId
      ? monthlyRehearsals.filter(r => r.projectId === filterProjectId)
      : monthlyRehearsals.filter(r => r.projectId && adminProjectIds.includes(r.projectId));

    // Calculate total hours
    const totalHours = adminRehearsals.reduce((sum, r) => {
      if (r.endTime && r.time) {
        const [startH, startM] = r.time.split(':').map(Number);
        const [endH, endM] = r.endTime.split(':').map(Number);
        const hours = (endH * 60 + endM - (startH * 60 + startM)) / 60;
        return sum + hours;
      }
      return sum + 2; // Default 2 hours if no end time
    }, 0);

    // Calculate average attendance from adminStats
    let totalConfirmed = 0;
    let totalInvited = 0;

    adminRehearsals.forEach(r => {
      const stat = adminStats[r.id];
      if (stat) {
        totalConfirmed += stat.confirmed;
        totalInvited += stat.confirmed + stat.declined + stat.pending;
      }
    });

    const avgAttendance = totalInvited > 0 ? Math.round((totalConfirmed / totalInvited) * 100) : 0;

    // Count active participants (unique across all rehearsals)
    const participantIds = new Set<string>();
    adminRehearsals.forEach(r => {
      // This is simplified - in real app you'd fetch actual participants
      const stat = adminStats[r.id];
      if (stat) {
        // Assuming each response represents a unique participant
        const total = stat.confirmed + stat.declined + stat.pending;
        for (let i = 0; i < total; i++) {
          participantIds.add(`${r.id}-${i}`);
        }
      }
    });

    return {
      rehearsalsCount: adminRehearsals.length,
      projectsCount: filterProjectId ? 1 : adminProjects.length,
      totalHours: Math.round(totalHours * 10) / 10,
      avgAttendance,
      activeParticipants: participantIds.size,
    };
  }, [rehearsals, adminProjects, adminStats, filterProjectId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {filterProjectId ? 'Статистика проекта' : 'Статистика (все проекты)'}
      </Text>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <Ionicons name="calendar" size={20} color={Colors.accent.purple} />
          </View>
          <Text style={styles.statValue}>{stats.rehearsalsCount}</Text>
          <Text style={styles.statLabel}>Репетиций в месяце</Text>
        </View>

        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <Ionicons name="time" size={20} color={Colors.accent.blue} />
          </View>
          <Text style={styles.statValue}>{stats.totalHours}ч</Text>
          <Text style={styles.statLabel}>Всего часов</Text>
        </View>

        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.accent.green} />
          </View>
          <Text style={styles.statValue}>{stats.avgAttendance}%</Text>
          <Text style={styles.statLabel}>Посещаемость</Text>
        </View>

        {!filterProjectId && (
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="folder" size={20} color={Colors.accent.purple} />
            </View>
            <Text style={styles.statValue}>{stats.projectsCount}</Text>
            <Text style={styles.statLabel}>Проектов</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.glass.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
