import { StyleSheet, Dimensions } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../../../shared/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const UPCOMING_CARD_WIDTH = SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md;
/** A rehearsal's row in the calendar's lists (T-036). */
const REHEARSAL_ROW_HEIGHT = 88;
/** The day on the left of a row; the text begins after it. */
const DATE_COLUMN_WIDTH = 52;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterButton: {
    // Takes the row, leaving the bell its square at the end.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  bellButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: Colors.glass.bg,
  },
  // Sits on the bell's shoulder, the way the OS badge sits on the app icon.
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.purpleFill,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.text.inverse,
  },
  filterButtonText: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: FontWeight.medium,
  },
  filterDropdown: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget,
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  filterOptionSelected: {
    backgroundColor: Colors.accent.purpleDarkAlpha10,
  },
  filterOptionText: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  filterOptionTextSelected: {
    color: Colors.accent.purple,
    fontWeight: FontWeight.semibold,
  },
  upcomingSection: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  upcomingList: {
    gap: Spacing.sm,
  },
  upcomingCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  upcomingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  // A list of rehearsals (T-036): rows on one rounded ground, 88 pt each —
  // 12 above and below three lines of 22, 20 and 18 with 2 between them.
  rehearsalList: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  rehearsalRow: {
    flexDirection: 'row',
    minHeight: REHEARSAL_ROW_HEIGHT,
    backgroundColor: Colors.bg.secondary,
  },
  rehearsalRowMainBox: {
    flex: 1,
  },
  rehearsalRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.md,
  },
  // No date column: the text begins where the screen's other lists begin.
  rehearsalRowMainNoDate: {
    paddingLeft: Spacing.lg,
  },
  rehearsalDateColumn: {
    width: DATE_COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: Spacing.xs,
  },
  rehearsalWeekday: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
  },
  rehearsalDayNumber: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  rehearsalRowText: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  rehearsalRowTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  rehearsalRowLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rehearsalRowTime: {
    fontSize: FontSize.md,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
  rehearsalRowSynced: {
    marginLeft: Spacing.xs,
  },
  rehearsalRowPlace: {
    flexShrink: 1,
    fontSize: FontSize.md,
    lineHeight: 20,
    color: Colors.text.secondary,
  },
  // The project is said, not coloured: purple is for doing and choosing
  // (T-031). Its own colour is the dot before it (projectColor.ts).
  rehearsalProjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  rehearsalRowProject: {
    flexShrink: 1,
    fontSize: FontSize.sm,
    lineHeight: 18,
    color: Colors.text.secondary,
  },
  // A thin line between two rows of a day, from where the text begins; one
  // across the whole ground between two days.
  rehearsalSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.default,
  },
  rehearsalSeparatorInset: {
    marginLeft: Spacing.md + DATE_COLUMN_WIDTH,
  },
  rehearsalSeparatorInsetNoDate: {
    marginLeft: Spacing.lg,
  },
  // An admin's swipe on a row (T-016): Edit, then Delete in red at the edge.
  swipeActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingLeft: Spacing.sm,
  },
  swipeAction: {
    // The card's height: gesture-handler's touchable is not stretched for it.
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    width: 84,
    borderRadius: BorderRadius.md,
  },
  swipeActionEdit: {
    backgroundColor: Colors.accent.purpleFill,
  },
  swipeActionDelete: {
    backgroundColor: Colors.accent.red,
  },
  swipeActionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.inverse,
  },
  // The list's ground under the row, so the actions do not show through it
  // while it slides.
  swipeRowUnder: {
    backgroundColor: Colors.bg.secondary,
  },
  skeletonRow: {
    marginBottom: Spacing.sm,
  },
  adminBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent.purpleDarkAlpha10,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  adminBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },
  upcomingContent: {
    gap: Spacing.xs,
  },
  emptyState: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: 16,
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  loadingState: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: 16,
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  errorState: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.accent.red,
    borderRadius: 16,
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: FontSize.base,
    color: Colors.accent.red,
  },
  // The eye at the row's right, 44 a side, its count under it (T-036).
  seenColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  seenButton: {
    width: TouchTarget,
    height: TouchTarget,
  },
  seenCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  // Smart Planner button styles
  smartPlannerContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  // Today's rehearsals section
  todaySection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  smartPlannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.purpleDarkAlpha15,
    borderWidth: 1,
    borderColor: Colors.accent.purpleDarkAlpha30,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  smartPlannerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartPlannerTextContainer: {
    flex: 1,
  },
  smartPlannerTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  smartPlannerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
});
