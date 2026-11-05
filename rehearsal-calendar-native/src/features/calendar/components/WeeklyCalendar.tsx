import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, TouchTarget } from '../../../shared/constants/colors';
import { Rehearsal } from '../../../shared/types';
import { addDays, parseDateString } from '../../../shared/utils/time';
import { useToday } from '../../../shared/hooks/useClock';
import { rehearsalDates } from '../../../shared/utils/rehearsalDays';
import { useI18n } from '../../../contexts/I18nContext';
import { formatDate } from '../../../shared/utils/dateFormat';
import { DayCalendar } from '../../../shared/components/DayCalendar';
import { hapticMedium, hapticSelection } from '../../../shared/utils/haptics';

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
 * It turns as a time picker's wheel (T-035, owner 04.11): a frame stands still
 * in the middle, and the day under it is the one highlighted — while the strip
 * moves, the next day comes under the frame, the highlight does not ride off
 * with its cell. Every day crossing the middle ticks, as the time wheel does;
 * the day under the frame is handed on to the list only where a swipe stops,
 * so the list does not jump while it moves. A tap, "Today" and the month
 * bring their day under the frame with the same ticks, and it is handed on
 * where the strip stops there, as a swipe's is.
 *
 * 72 pt tall, a day 48 wide: never under 44 (T-014), and about seven on a
 * phone's width.
 */
const STRIP_HEIGHT = 72;
const DAY_WIDTH = 48;
const CARD_BORDER = 1;
const CARD_PADDING_X = Spacing.xs;
const CARD_INSET = CARD_BORDER + CARD_PADDING_X;
/** The frame, as a day's cell is drawn: 2 pt in from either side. */
const FRAME_INSET = 2;
/** A year on each side of today, as the weeks were. */
const RANGE_DAYS = 366;
/** How long a let-go waits for a momentum to begin before it is a stop. */
const RELEASE_STOP_MS = 100;

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

  // The day under the frame, highlighted and named by the month; it follows
  // the strip as it moves, a tick each time it changes.
  const [middleIndex, setMiddleIndex] = useState(selectedIndex);
  const centre = useRef(selectedIndex);
  // Where the strip rests, or is being taken by a tap, "Today" or the month.
  const target = useRef(selectedIndex);
  // A scroll of ours is on its way: a stop before its day is not a choice.
  const travelling = useRef(false);
  // What a tap, "Today" or the month asked for, handed on to the list only
  // when the strip stops on its day: "Today" hands on today to follow.
  const pendingToday = useRef(false);

  // The day under the frame moves to `index`: a tick for every day crossing
  // the middle, however many one event jumps over — a fast fling or a long
  // way to a day picked in the month passes several between two events.
  const moveCentre = useCallback((index: number, ticking: boolean) => {
    const crossed = Math.abs(index - centre.current);
    if (crossed === 0) return;
    centre.current = index;
    setMiddleIndex(index);
    if (ticking) for (let i = 0; i < crossed; i++) hapticSelection();
  }, []);

  const scrollTo = useCallback((index: number, animated: boolean) => {
    target.current = index;
    travelling.current = animated;
    // Not animated, the days moved under the frame; nothing crossed it.
    if (!animated) moveCentre(index, false);
    listRef.current?.scrollToOffset({ offset: index * DAY_WIDTH, animated });
  }, [moveCentre]);

  // The selected day goes to the middle, wherever it was chosen: a tap, the
  // month, "Today". When the days themselves move — today has — it is put
  // there at once.
  const shownFirst = useRef(firstDay);
  useEffect(() => {
    const moved = shownFirst.current !== firstDay;
    shownFirst.current = firstDay;
    if (moved || target.current !== selectedIndex) scrollTo(selectedIndex, !moved);
  }, [selectedIndex, firstDay, scrollTo]);

  const indexAt = useCallback((offsetX: number) => (
    Math.min(days.length - 1, Math.max(0, Math.round(offsetX / DAY_WIDTH)))
  ), [days.length]);

  // A day crossing the middle comes under the frame, and ticks.
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    moveCentre(indexAt(event.nativeEvent.contentOffset.x), true);
  }, [indexAt, moveCentre]);

  // A finger let go on a day's edge is not yet a stop: the strip may still
  // fly on — it was taken as one, and the list changed to the day let go on,
  // then again where the strip came to rest (review 2, T-035). The stop is
  // waited for a moment; a momentum beginning — which UIKit starts in the
  // same touch's end, right after the let-go — means the strip goes on, and
  // its end is the stop. None coming, it stood still where it was let go.
  const releasedStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelReleasedStop = useCallback(() => {
    if (releasedStop.current !== null) clearTimeout(releasedStop.current);
    releasedStop.current = null;
  }, []);
  useEffect(() => cancelReleasedStop, [cancelReleasedStop]);

  // A finger on the strip takes it from wherever a scroll of ours was going,
  // and what it was going there for.
  const handleDragBegin = useCallback(() => {
    travelling.current = false;
    pendingToday.current = false;
    cancelReleasedStop();
  }, [cancelReleasedStop]);

  // The day under the frame, where the strip rests, is handed on to the list.
  const choose = useCallback((index: number) => {
    target.current = index;
    if (pendingToday.current) {
      pendingToday.current = false;
      onShowToday();
      return;
    }
    const date = days[index].date;
    if (date !== selectedDate) onDaySelect(date);
  }, [days, selectedDate, onDaySelect, onShowToday]);

  // Where the strip stops, the day under the frame is the one selected.
  const settle = useCallback((offsetX: number) => {
    const index = indexAt(offsetX);
    if (travelling.current && index !== target.current) return;
    travelling.current = false;
    moveCentre(index, true);
    choose(index);
  }, [indexAt, moveCentre, choose]);

  // A tap, "Today" or the month: the strip is taken to the day, and the day is
  // chosen where it stops there. Already under the frame, it is chosen now —
  // no scroll comes to stop.
  const bringIn = useCallback((index: number, today: boolean) => {
    pendingToday.current = today;
    scrollTo(index, true);
    if (index === centre.current) {
      travelling.current = false;
      choose(index);
    }
  }, [scrollTo, choose]);

  const handleMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    cancelReleasedStop();
    settle(event.nativeEvent.contentOffset.x);
  }, [cancelReleasedStop, settle]);
  // A drag let go on a day, with nothing left to snap: a stop, unless a
  // momentum follows.
  const handleDragEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    cancelReleasedStop();
    if (Math.abs(x - Math.round(x / DAY_WIDTH) * DAY_WIDTH) >= 1) return;
    releasedStop.current = setTimeout(() => {
      releasedStop.current = null;
      settle(x);
    }, RELEASE_STOP_MS);
  }, [cancelReleasedStop, settle]);

  const monthYear = useMemo(
    () => formatDate(days[middleIndex]?.date ?? today, 'monthYear', language),
    [days, middleIndex, today, language],
  );

  const [monthOpen, setMonthOpen] = useState(false);
  // The day comes under the frame with the strip's ticks, as from a tap.
  const handlePickInMonth = useCallback((date: string) => {
    setMonthOpen(false);
    const index = indexOf.get(date);
    if (index !== undefined) bringIn(index, false);
  }, [indexOf, bringIn]);

  // Today's day, not only its place: this scrolled the strip back and left the
  // day picked before selected, so the list under it went on showing that day
  // (DD03).
  const handleGoToToday = useCallback(() => {
    bringIn(indexOf.get(today)!, true);
  }, [bringIn, indexOf, today]);

  const renderDay = useCallback(({ item, index }: { item: DayItem; index: number }) => {
    // The day under the frame; the frame itself is drawn behind the strip.
    const isSelected = index === middleIndex;
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
        onPress={() => bringIn(index, false)}
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
        ]}>
          <Text style={[
            styles.dayOfWeek,
            isSelected && styles.textSelected,
          ]}>
            {dayNames[parseDateString(item.date).getDay()]}
          </Text>

          <Text style={[
            styles.dayOfMonth,
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
  }, [middleIndex, today, rehearsalCountMap, dayNames, bringIn, onDayLongPress]);

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

      {/* The days, the selected one in the middle, under a frame that stays
          there: drawn behind the strip, so the day's digits stand on it. */}
      <View style={styles.strip}>
        <View
          testID="calendar-strip-frame"
          pointerEvents="none"
          style={[styles.frame, { left: edge + FRAME_INSET, width: DAY_WIDTH - 2 * FRAME_INSET }]}
        />
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
          onScrollBeginDrag={handleDragBegin}
          onScrollEndDrag={handleDragEnd}
          onMomentumScrollBegin={cancelReleasedStop}
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
  // The days stand bare on the card, as a wheel's values do: a fill of their
  // own would slide over the frame as they pass it (T-035).
  dayCell: {
    flex: 1,
    marginHorizontal: FRAME_INSET,
    marginVertical: Spacing.xs,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Today is ringed, the day picked is filled: both purple, told apart by
  // the fill (T-031). The ring alone, not the digit: purple on this cell is
  // 4.37:1, under the 4.5:1 text needs.
  dayToday: {
    borderWidth: 2,
    borderColor: Colors.accent.purple,
  },
  // The fill of the day picked, standing still in the middle. Under white
  // text: purpleFill (T-027).
  frame: {
    position: 'absolute',
    top: Spacing.xs,
    bottom: Spacing.xs,
    borderRadius: 12,
    backgroundColor: Colors.accent.purpleFill,
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
    color: Colors.accent.purpleFill,
  },
});
