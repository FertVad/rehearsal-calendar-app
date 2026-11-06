import { StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, TouchTarget } from '../../../shared/constants/colors';

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
    paddingBottom: Spacing.xxl * 2,
  },
  explanation: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.xl,
    marginHorizontal: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
  },

  // Permission card
  permissionCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  permissionStatus: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: Spacing.md,
    minWidth: 200,
  },

  // Settings items
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: FontWeight.medium,
  },

  // Action buttons
  actionButton: {
    marginBottom: Spacing.md,
  },

  // Calendar Picker Button
  calendarPickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: TouchTarget,
    padding: Spacing.md,
    backgroundColor: Colors.glass.bg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    marginBottom: Spacing.md,
  },
  calendarPickerButtonSelected: {
    backgroundColor: Colors.accent.purpleAlpha15,
    borderColor: Colors.accent.purple,
  },
  calendarPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  calendarPickerText: {
    flex: 1,
  },
  calendarPickerLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: FontWeight.medium,
  },
  calendarPickerSubtext: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs / 2,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },

  // Inline calendar picker list
  calendarPickerList: {
    gap: Spacing.sm,
  },
  calendarPickerItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: TouchTarget,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  calendarPickerItemSelected: {
    borderColor: Colors.accent.green,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  calendarPickerItemLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  calendarPickerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calendarPickerItemLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },

  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  syncStatusText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  removeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    minHeight: TouchTarget,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  removeAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent.red,
  },
});
