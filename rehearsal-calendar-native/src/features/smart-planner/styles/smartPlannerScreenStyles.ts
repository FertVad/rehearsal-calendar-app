import { StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../../../shared/constants/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  headerContainer: {
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg.secondary,
  },
  backButton: {
    marginRight: Spacing.xs,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  filtersContainer: {
    marginBottom: Spacing.md,
  },
  // One row of 44 pt, the three filters in it (T-020).
  filters: {
    height: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
  },
  // Each of the three gives way, by its length, and its words end in "…". The
  // period and the people did not: "Período personalizado · Participantes:
  // todos (3)" took the row, the project was left its chevron, and the row ran
  // off the screen's edge (T-020 review).
  filter: {
    height: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 1,
  },
  filterText: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    flexShrink: 1,
  },
  filterDot: {
    fontSize: FontSize.md,
    color: Colors.text.tertiary,
  },
  choice: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
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
