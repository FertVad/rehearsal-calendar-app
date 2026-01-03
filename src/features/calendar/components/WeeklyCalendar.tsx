import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { formatDateToString } from '../../../shared/utils/time';
import { useI18n } from '../../../contexts/I18nContext';
import { useWeekStart, getWeekStart as getWeekStartUtil } from '../../../hooks/useWeekStart';
import { hapticLight } from '../../../shared/utils/haptics';

interface WeeklyCalendarProps {
  rehearsals: Rehearsal[];
  onDaySelect: (date: string) => void;
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
const INITIAL_WEEKS = 13; // ~3 months on each side
const CENTER_INDEX = Math.floor(INITIAL_WEEKS / 2);

export default function WeeklyCalendar({ rehearsals, onDaySelect, onDayLongPress, selectedDate }: WeeklyCalendarProps) {
  const { t, language } = useI18n();
  const weekStartDay = useWeekStart();
  const flatListRef = useRef<FlatList>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(CENTER_INDEX);

  const DAYS_OF_WEEK = useMemo(() => {
    const daysMonday = language === 'ru'
      ? ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']
      : ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

    const daysSunday = language === 'ru'
      ? ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
      : ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    return weekStartDay === 'monday' ? daysMonday : daysSunday;
  }, [language, weekStartDay]);

  // Get the start of current week based on user preference
  const getWeekStart = useCallback((date: Date): Date => {
    return getWeekStartUtil(date, weekStartDay);
  }, [weekStartDay]);

  // Generate week data
  const generateWeekData = useCallback((weekStart: Date): DayInfo[] => {
    const days: DayInfo[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);

      const dateString = formatDateToString(date);
      const rehearsalCount = rehearsals.filter(r => r.date === dateString).length;

      days.push({
        date: dateString,
        dayOfWeek: DAYS_OF_WEEK[i],
        dayOfMonth: date.getDate(),
        isToday: date.getTime() === today.getTime(),
        rehearsalCount,
      });
    }

    return days;
  }, [rehearsals]);

  // Generate all weeks
  const weeks = useMemo((): WeekData[] => {
    const result: WeekData[] = [];
    const todayWeekStart = getWeekStart(new Date());

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
  }, [getWeekStart, generateWeekData]);

  // Get current week's month/year
  const monthYear = useMemo(() => {
    if (weeks[currentWeekIndex]) {
      const weekStart = weeks[currentWeekIndex].weekStart;
      const locale = language === 'ru' ? 'ru-RU' : 'en-US';
      const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
      return weekStart.toLocaleDateString(locale, options);
    }

    const now = new Date();
    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    return now.toLocaleDateString(locale, options);
  }, [weeks, currentWeekIndex, language]);

  // Handle scroll to update current week index and haptic feedback
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / WEEK_WIDTH);
    if (newIndex !== currentWeekIndex && newIndex >= 0 && newIndex < weeks.length) {
      hapticLight();
      setCurrentWeekIndex(newIndex);
    }
  }, [currentWeekIndex, weeks.length]);

  // Navigate to today's week
  const handleGoToToday = useCallback(() => {
    hapticLight();
    flatListRef.current?.scrollToIndex({
      index: CENTER_INDEX,
      animated: true,
    });
    setCurrentWeekIndex(CENTER_INDEX);
  }, []);

  // Render a single week
  const renderWeek = useCallback(({ item }: { item: WeekData }) => (
    <View style={[styles.weekContainer, { width: WEEK_WIDTH }]}>
      <View style={styles.weekGrid}>
        {item.days.map((day) => {
          const isSelected = day.date === selectedDate;

          return (
            <TouchableOpacity
              key={day.date}
              style={[
                styles.dayCell,
                day.isToday && styles.dayToday,
                isSelected && styles.daySelected,
              ]}
              onPress={() => {
                hapticLight();
                onDaySelect(day.date);
              }}
              onLongPress={() => {
                hapticLight();
                onDayLongPress?.(day.date);
              }}
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
        <TouchableOpacity onPress={handleGoToToday} style={styles.todayButton}>
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
    position: 'relative',
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
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
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
