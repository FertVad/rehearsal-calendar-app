import { StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../../../shared/constants/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  // No project yet: its loading, or the hint to make one.
  noProject: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  noProjectTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  noProjectText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  // The filters' row right under the large title (T-032).
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  // The project, the period and the people, one under another (T-241).
  filters: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  // The project: its name and a chevron after it, or its name alone.
  project: {
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
  },
  projectName: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  // Nothing to choose: a name, not something to tap.
  projectNameOnly: {
    color: Colors.text.primary,
  },
  // Week | Month | Dates, equal, the picked one lifted.
  segments: {
    flexDirection: 'row',
    padding: 2,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
  },
  // 44 tall each, the finger's least (T-014).
  segment: {
    flex: 1,
    minHeight: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md - 2,
  },
  segmentSelected: {
    backgroundColor: Colors.accent.purpleDarkAlpha30,
  },
  segmentText: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  segmentTextSelected: {
    color: Colors.accent.purple,
    fontWeight: FontWeight.semibold,
  },
  choice: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  optionSelected: {
    backgroundColor: Colors.accent.purpleDarkAlpha10,
  },
  optionText: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  optionTextSelected: {
    color: Colors.accent.purple,
    fontWeight: FontWeight.semibold,
  },
  listTitle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  listTitleText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  unknownNote: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  periodDate: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyStateTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyStateText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
