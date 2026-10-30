import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { formatDateToString, parseDateString } from '../../../shared/utils/time';
import { useToday } from '../../../shared/hooks/useClock';
import { rehearsalDates } from '../../../shared/utils/rehearsalDays';
import { useI18n } from '../../../contexts/I18nContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { useWeekStart, getWeekStart as getWeekStartUtil } from '../../../hooks/useWeekStart';
import { hapticMedium } from '../../../shared/utils/haptics';

interface WeeklyCalendarProps {
  rehearsals: Rehearsal[];
  onDaySelect: (date: string) => void;
  /**
   * "Today": the day shown goes back to today and moves with it again, at
   * midnight and with the profile's zone — what it is before any day is picked.
   */
  onShowToday: () => void;
  onDayLongPress?: (date: string) => void;
  selectedDate: string;
}

interface DayInfo {
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  isToday: boolean;
  rehearsalCount: number;
}

interface WeekData {
  id: string;
  weekStart: Date;
  days: DayInfo[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WEEK_WIDTH = SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md * 2; // Account for container padding
const INITIAL_WEEKS = 105; // ~1 year on each side
const CENTER_INDEX = Math.floor(INITIAL_WEEKS / 2);

export default function WeeklyCalendar({ rehearsals, onDaySelect, onShowToday, onDayLongPress, selectedDate }: WeeklyCalendarProps) {
  const { t, language } = useI18n();
  const weekStartDay = useWeekStart();
  const flatListRef = useRef<FlatList>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(CENTER_INDEX);

  const DAYS_OF_WEEK = useMemo(() => {
    const s = t.days.short;
    const daysMonday = [s.monday, s.tuesday, s.wednesday, s.thursday, s.friday, s.saturday, s.sunday];
    const daysSunday = [s.sunday, s.monday, s.tuesday, s.wednesday, s.thursday, s.friday, s.saturday];
    return weekStartDay === 'monday' ? daysMonday : daysSunday;
  }, [t, weekStartDay]);

  // Get the start of current week based on user preference
  const getWeekStart = useCallback((date: Date): Date => {
    return getWeekStartUtil(date, weekStartDay);
  }, [weekStartDay]);

  // Rehearsals per day, counted on every day each one is on — one running past
  // midnight counts on the next day too (DD02).
  const rehearsalCountMap = useMemo(() => {
    const map = new Map<string, number>();
    rehearsals.forEach(r => {
      for (const date of rehearsalDates(r)) {
        map.set(date, (map.get(date) || 0) + 1);
      }
    });
    return map;
  }, [rehearsals]);

  // Today in the profile's zone, the one rehearsals are dated in (DF01).
  const today = useToday();

  // Generate week data
  const generateWeekData = useCallback((weekStart: Date): DayInfo[] => {
    const days: DayInfo[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);

      const dateString = formatDateToString(date);
      const rehearsalCount = rehearsalCountMap.get(dateString) || 0;

      days.push({
        date: dateString,
        dayOfWeek: DAYS_OF_WEEK[i],
        dayOfMonth: date.getDate(),
        isToday: dateString === today,
        rehearsalCount,
      });
    }

    return days;
  }, [rehearsalCountMap, DAYS_OF_WEEK, today]);

  // Generate all weeks
  const weeks = useMemo((): WeekData[] => {
    const result: WeekData[] = [];
    const todayWeekStart = getWeekStart(parseDateString(today));

    for (let i = -CENTER_INDEX; i <= CENTER_INDEX; i++) {
      const weekStart = new Date(todayWeekStart);
      weekStart.setDate(todayWeekStart.getDate() + i * 7);

      result.push({
        id: `week-${i}`,
        weekStart: new Date(weekStart),
        days: generateWeekData(weekStart),
      });
    }

    return result;
  }, [getWeekStart, generateWeekData, today]);

  // Show the month of the week's middle day so the header flips when the
  // majority of visible days have crossed into a new month — not when the
  // very first day of the week does.
  const monthYear = useMemo(() => {
    const locale = getDateLocale(language);
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    const week = weeks[currentWeekIndex];
    const reference = week ? new Date(week.weekStart) : new Date();
    if (week) reference.setDate(reference.getDate() + 3);
    return reference.toLocaleDateString(locale, options);
  }, [weeks, currentWeekIndex, language]);

  // Handle scroll to update current week index and haptic feedback
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / WEEK_WIDTH);
    if (newIndex !== currentWeekIndex && newIndex >= 0 && newIndex < weeks.length) {
      hapticMedium();
      setCurrentWeekIndex(newIndex);
    }
  }, [currentWeekIndex, weeks.length]);

  // Today's day, not only its week: this scrolled the strip back and left the
  // day picked before selected, so the list under it went on showing that day,
  // likely in a week no longer on screen (DD03). Today's week is the centre one.
  const handleGoToToday = useCallback(() => {
    hapticMedium();
    onShowToday();
    flatListRef.current?.scrollToIndex({
      index: CENTER_INDEX,
      animated: true,
    });
    setCurrentWeekIndex(CENTER_INDEX);
  }, [onShowToday]);

  // Render a single week
  const renderWeek = useCallback(({ item }: { item: WeekData }) => (
    <View style={[styles.weekContainer, { width: WEEK_WIDTH }]}>
      <View style={styles.weekGrid}>
        {item.days.map((day) => {
          const isSelected = day.date === selectedDate;

          return (
            <TouchableOpacity
              key={day.date}
              testID={`calendar-day-${day.date}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.dayCell,
                day.isToday && styles.dayToday,
                isSelected && styles.daySelected,
              ]}
              onPress={() => {
                hapticMedium();
                onDaySelect(day.date);
              }}
              onLongPress={onDayLongPress && (() => {
                hapticMedium();
                onDayLongPress(day.date);
              })}
              delayLongPress={400}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayOfWeek,
                isSelected && styles.textSelected,
              ]}>
                {day.dayOfWeek}
              </Text>

              <Text style={[
                styles.dayOfMonth,
                day.isToday && styles.textToday,
                isSelected && styles.textSelected,
              ]}>
                {day.dayOfMonth}
              </Text>

              {/* Under the date, in a slot every cell keeps: in the corner,
                  absolute, it covered the day's name (T-011). */}
              <View testID={`calendar-day-count-${day.date}`} style={styles.badgeSlot}>
                {day.rehearsalCount > 0 && (
                  <View style={[
                    styles.badge,
                    isSelected && styles.badgeSelected,
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      isSelected && styles.badgeTextSelected,
                    ]}>
                      {day.rehearsalCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  ), [selectedDate, onDaySelect, onDayLongPress]);

  // Scroll to today's week on mount
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: CENTER_INDEX,
        animated: false,
      });
    }, 100);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header with month/year and today button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoToToday}
          style={styles.todayButton}
          testID="calendar-today"
          accessibilityRole="button"
        >
          <Text style={styles.todayButtonText}>{t.calendar.todayButton}</Text>
        </TouchableOpacity>

        <Text style={styles.monthYear}>{monthYear}</Text>

        <View style={styles.placeholder} />
      </View>

      {/* Scrollable weeks */}
      <FlatList
        ref={flatListRef}
        data={weeks}
        renderItem={renderWeek}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: WEEK_WIDTH,
          offset: WEEK_WIDTH * index,
          index,
        })}
        initialScrollIndex={CENTER_INDEX}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          }, 500);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: 16,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  monthYear: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  todayButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    backgroundColor: Colors.accent.purple,
  },
  todayButtonText: {
    fontSize: FontSize.sm,
    color: Colors.text.inverse,
    fontWeight: FontWeight.medium,
  },
  placeholder: {
    width: 64, // Same width as today button for centering
  },
  weekContainer: {
    paddingHorizontal: 2,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: Colors.accent.blue,
  },
  daySelected: {
    backgroundColor: Colors.accent.purple,
  },
  dayOfWeek: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  dayOfMonth: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  textToday: {
    color: Colors.accent.blue,
  },
  textSelected: {
    color: Colors.text.inverse,
  },
  badgeSlot: {
    height: 16,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.accent.purple,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeSelected: {
    backgroundColor: Colors.text.inverse,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.text.inverse,
  },
  badgeTextSelected: {
    color: Colors.accent.purple,
  },
});
