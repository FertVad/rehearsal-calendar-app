import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, TouchTarget } from '../../../shared/constants/colors';
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

/**
 * A week is seven days of 44 pt side by side, 308 (T-014). The card sits in
 * the calendar screen's margin; on a screen too narrow for the days within it
 * (320 pt, an SE with Display Zoom) the card reaches into that margin rather
 * than the days shrinking or running off their page.
 */
const SCREEN_MARGIN = Spacing.xl;
const CARD_BORDER = 1;
const CARD_PADDING_X = Spacing.xs;
const CARD_INSET = CARD_BORDER + CARD_PADDING_X;
const WEEK_MIN_WIDTH = 7 * TouchTarget;

function cardReach(screenWidth: number): number {
  const room = screenWidth - 2 * SCREEN_MARGIN - 2 * CARD_INSET;
  return Math.min(SCREEN_MARGIN, Math.max(0, (WEEK_MIN_WIDTH - room) / 2));
}

const INITIAL_WEEKS = 105; // ~1 year on each side
const CENTER_INDEX = Math.floor(INITIAL_WEEKS / 2);

export default function WeeklyCalendar({ rehearsals, onDaySelect, onShowToday, onDayLongPress, selectedDate }: WeeklyCalendarProps) {
  const { t, language } = useI18n();
  const weekStartDay = useWeekStart();
  const flatListRef = useRef<FlatList>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(CENTER_INDEX);
  const screenWidth = Dimensions.get('window').width;
  const reach = cardReach(screenWidth);
  // A page is the width the list is laid out at, and so is the step between
  // pages: they were both a guess from the screen's width, and six points
  // apart (T-014 review). Until the list is laid out, the same sum.
  const [weekWidth, setWeekWidth] = useState(
    screenWidth - 2 * (SCREEN_MARGIN - reach) - 2 * CARD_INSET,
  );
  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== weekWidth) setWeekWidth(width);
  }, [weekWidth]);

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
    const newIndex = Math.round(offsetX / weekWidth);
    if (newIndex !== currentWeekIndex && newIndex >= 0 && newIndex < weeks.length) {
      hapticMedium();
      setCurrentWeekIndex(newIndex);
    }
  }, [currentWeekIndex, weeks.length, weekWidth]);

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
    <View style={{ width: weekWidth }}>
      <View style={styles.weekGrid}>
        {item.days.map((day) => {
          const isSelected = day.date === selectedDate;

          // The cell takes the tap across its whole seventh of the week; the
          // gap between the drawn days is inside it. With the gap outside, a
          // day was 42 pt wide (T-014).
          return (
            <TouchableOpacity
              key={day.date}
              testID={`calendar-day-${day.date}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={styles.dayTarget}
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
              <View style={[
                styles.dayCell,
                day.isToday && styles.dayToday,
                isSelected && styles.daySelected,
              ]}>
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
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  ), [selectedDate, onDaySelect, onDayLongPress, weekWidth]);

  // Scroll to today's week on mount
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: CENTER_INDEX,
        animated: false,
      });
    }, 100);
  }, []);

  // A page of a new width moves the pages: the week on screen stays on it.
  const shownWeek = useRef(currentWeekIndex);
  shownWeek.current = currentWeekIndex;
  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: shownWeek.current * weekWidth, animated: false });
  }, [weekWidth]);

  return (
    <View style={[styles.container, { marginHorizontal: -reach }]}>
      {/* Header with month/year and today button */}
      <View style={styles.header}>
        {/* The pill is what shows; the tap is taken on 44 pt around it. */}
        <TouchableOpacity
          onPress={handleGoToToday}
          style={styles.todayTarget}
          testID="calendar-today"
          accessibilityRole="button"
        >
          <View style={styles.todayButton}>
            <Text style={styles.todayButtonText}>{t.calendar.todayButton}</Text>
          </View>
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
        onLayout={handleListLayout}
        extraData={weekWidth}
        getItemLayout={(_, index) => ({
          length: weekWidth,
          offset: weekWidth * index,
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
    borderWidth: CARD_BORDER,
    borderColor: Colors.glass.border,
    borderRadius: 16,
    paddingVertical: Spacing.sm,
    paddingHorizontal: CARD_PADDING_X,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthYear: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  todayTarget: {
    minWidth: TouchTarget,
    minHeight: TouchTarget,
    justifyContent: 'center',
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
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // A seventh of the page, never more: a day wider than that ran off its
  // week's page. The page is made wide enough for 44 (cardReach).
  dayTarget: {
    flex: 1,
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
