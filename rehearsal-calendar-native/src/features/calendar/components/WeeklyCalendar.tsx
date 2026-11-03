import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, TouchTarget } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { addDays, parseDateString } from '../../../shared/utils/time';
import { useToday } from '../../../shared/hooks/useClock';
import { rehearsalDates } from '../../../shared/utils/rehearsalDays';
import { useI18n } from '../../../contexts/I18nContext';
import { getDateLocale } from '../../../shared/utils/locale';
import { DayCalendar } from '../../../shared/components/DayCalendar';
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

interface DayItem {
  date: string;
}

/**
 * A strip of days, the selected one in its middle (T-019). It was a week to a
 * page, and the day picked could stand at the page's edge. A tap brings the
 * day to the middle, a swipe stops on a day and selects it, "Today" brings
 * today. The week's first day plays no part here; it is the month's.
 *
 * 72 pt tall, a day 48 wide: never under 44 (T-014), and about seven on a
 * phone's width.
 */
const STRIP_HEIGHT = 72;
const DAY_WIDTH = 48;
const CARD_BORDER = 1;
const CARD_PADDING_X = Spacing.xs;
const CARD_INSET = CARD_BORDER + CARD_PADDING_X;
/** A year on each side of today, as the weeks were. */
const RANGE_DAYS = 366;

export default function WeeklyCalendar({ rehearsals, onDaySelect, onShowToday, onDayLongPress, selectedDate }: WeeklyCalendarProps) {
  const { t, language } = useI18n();
  const listRef = useRef<FlatList<DayItem>>(null);
  // The width the strip is laid out at; until then, the screen's less the
  // calendar screen's margin and the card's.
  const [stripWidth, setStripWidth] = useState(
    Dimensions.get('window').width - 2 * Spacing.xl - 2 * CARD_INSET,
  );
  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) setStripWidth(width);
  }, []);
  // The first and the last day stand in the middle too.
  const edge = Math.max(0, (stripWidth - DAY_WIDTH) / 2);

  const dayNames = useMemo(() => {
    const s = t.days.short;
    return [s.sunday, s.monday, s.tuesday, s.wednesday, s.thursday, s.friday, s.saturday];
  }, [t]);

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
  const rehearsalDays = useMemo(() => new Set(rehearsalCountMap.keys()), [rehearsalCountMap]);

  // Today in the profile's zone, the one rehearsals are dated in (DF01).
  const today = useToday();
  const firstDay = addDays(today, -RANGE_DAYS);
  const lastDay = addDays(today, RANGE_DAYS);

  const days = useMemo((): DayItem[] => {
    const result: DayItem[] = [];
    for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) result.push({ date: day });
    return result;
  }, [firstDay, lastDay]);
  const indexOf = useMemo(() => new Map(days.map((d, i) => [d.date, i])), [days]);
  const selectedIndex = indexOf.get(selectedDate) ?? indexOf.get(today)!;

  // The day in the middle while the strip moves, for the month it names.
  const [middleIndex, setMiddleIndex] = useState(selectedIndex);
  const middle = useRef(selectedIndex);

  const scrollTo = useCallback((index: number, animated: boolean) => {
    middle.current = index;
    setMiddleIndex(index);
    listRef.current?.scrollToOffset({ offset: index * DAY_WIDTH, animated });
  }, []);

  // The selected day goes to the middle, wherever it was chosen: a tap, the
  // month, "Today". When the days themselves move — today has — it is put
  // there at once.
  const shownFirst = useRef(firstDay);
  useEffect(() => {
    const moved = shownFirst.current !== firstDay;
    shownFirst.current = firstDay;
    if (moved || middle.current !== selectedIndex) scrollTo(selectedIndex, !moved);
  }, [selectedIndex, firstDay, scrollTo]);

  const indexAt = useCallback((offsetX: number) => (
    Math.min(days.length - 1, Math.max(0, Math.round(offsetX / DAY_WIDTH)))
  ), [days.length]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = indexAt(event.nativeEvent.contentOffset.x);
    if (index !== middleIndex) setMiddleIndex(index);
  }, [indexAt, middleIndex]);

  // Where the strip stops, the day in the middle is the one selected.
  const settle = useCallback((offsetX: number) => {
    const index = indexAt(offsetX);
    middle.current = index;
    setMiddleIndex(index);
    const date = days[index].date;
    if (date !== selectedDate) {
      hapticMedium();
      onDaySelect(date);
    }
  }, [indexAt, days, selectedDate, onDaySelect]);

  const handleMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    settle(event.nativeEvent.contentOffset.x);
  }, [settle]);
  // A drag let go on a day, with nothing left to snap, has no momentum after it.
  const handleDragEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    if (Math.abs(x - Math.round(x / DAY_WIDTH) * DAY_WIDTH) < 1) settle(x);
  }, [settle]);

  const monthYear = useMemo(() => {
    const locale = getDateLocale(language);
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    return parseDateString(days[middleIndex]?.date ?? today).toLocaleDateString(locale, options);
  }, [days, middleIndex, today, language]);

  const [monthOpen, setMonthOpen] = useState(false);
  const handlePickInMonth = useCallback((date: string) => {
    hapticMedium();
    setMonthOpen(false);
    onDaySelect(date);
  }, [onDaySelect]);

  // Today's day, not only its place: this scrolled the strip back and left the
  // day picked before selected, so the list under it went on showing that day
  // (DD03).
  const handleGoToToday = useCallback(() => {
    hapticMedium();
    onShowToday();
    scrollTo(indexOf.get(today)!, true);
  }, [onShowToday, scrollTo, indexOf, today]);

  const renderDay = useCallback(({ item }: { item: DayItem }) => {
    const isSelected = item.date === selectedDate;
    const isToday = item.date === today;
    const rehearsalCount = rehearsalCountMap.get(item.date) || 0;

    // The cell takes the tap across its whole width; the gap between the
    // drawn days is inside it (T-014).
    return (
      <TouchableOpacity
        testID={`calendar-day-${item.date}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        style={styles.dayTarget}
        onPress={() => {
          hapticMedium();
          onDaySelect(item.date);
        }}
        onLongPress={onDayLongPress && (() => {
          hapticMedium();
          onDayLongPress(item.date);
        })}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={[
          styles.dayCell,
          isToday && styles.dayToday,
          isSelected && styles.daySelected,
        ]}>
          <Text style={[
            styles.dayOfWeek,
            isSelected && styles.textSelected,
          ]}>
            {dayNames[parseDateString(item.date).getDay()]}
          </Text>

          <Text style={[
            styles.dayOfMonth,
            isToday && styles.textToday,
            isSelected && styles.textSelected,
          ]}>
            {Number(item.date.slice(8))}
          </Text>

          {/* Under the date, in a slot every cell keeps: in the corner,
              absolute, it covered the day's name (T-011). */}
          <View testID={`calendar-day-count-${item.date}`} style={styles.badgeSlot}>
            {rehearsalCount > 0 && (
              <View style={[
                styles.badge,
                isSelected && styles.badgeSelected,
              ]}>
                <Text style={[
                  styles.badgeText,
                  isSelected && styles.badgeTextSelected,
                ]}>
                  {rehearsalCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selectedDate, today, rehearsalCountMap, dayNames, onDaySelect, onDayLongPress]);

  return (
    <View style={styles.container}>
      {/* Header with today button and month/year, which opens the month */}
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

        <TouchableOpacity
          onPress={() => setMonthOpen(open => !open)}
          style={styles.monthTarget}
          testID="calendar-month"
          accessibilityRole="button"
          accessibilityState={{ expanded: monthOpen }}
        >
          <Text style={styles.monthYear}>{monthYear}</Text>
          <Ionicons
            name={monthOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.text.secondary}
          />
        </TouchableOpacity>

        <View style={styles.placeholder} />
      </View>

      {monthOpen && (
        <DayCalendar
          testID="calendar-month-grid"
          value={selectedDate}
          onChange={handlePickInMonth}
          pastOpen
          dotted={rehearsalDays}
          minDate={firstDay}
          maxDate={lastDay}
        />
      )}

      {/* The days, the selected one in the middle */}
      <FlatList
        ref={listRef}
        testID="calendar-strip"
        style={styles.strip}
        data={days}
        renderItem={renderDay}
        keyExtractor={(item) => item.date}
        extraData={renderDay}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: edge }}
        snapToInterval={DAY_WIDTH}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollEndDrag={handleDragEnd}
        onMomentumScrollEnd={handleMomentumEnd}
        onLayout={handleListLayout}
        // An offset is the day's place less the edge: the day at `index` is in
        // the middle at index * DAY_WIDTH.
        getItemLayout={(_, index) => ({
          length: DAY_WIDTH,
          offset: DAY_WIDTH * index,
          index,
        })}
        initialScrollIndex={selectedIndex}
        initialNumToRender={15}
        windowSize={11}
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
  monthTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.sm,
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
    backgroundColor: Colors.accent.purpleFill,
  },
  todayButtonText: {
    fontSize: FontSize.sm,
    color: Colors.text.inverse,
    fontWeight: FontWeight.medium,
  },
  placeholder: {
    width: 64, // Same width as today button for centering
  },
  strip: {
    height: STRIP_HEIGHT,
  },
  dayTarget: {
    width: DAY_WIDTH,
    height: STRIP_HEIGHT,
  },
  dayCell: {
    flex: 1,
    marginHorizontal: 2,
    marginVertical: Spacing.xs,
    borderRadius: 12,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: Colors.accent.purpleFill,
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
