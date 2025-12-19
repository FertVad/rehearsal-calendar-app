import { StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '../../../shared/constants/colors';

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    flex: 1,
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
  permissionGranted: {
    borderColor: Colors.accent.green,
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
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '50%',
  },
  settingValue: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },

  // Action buttons
  actionButton: {
    marginBottom: Spacing.md,
  },

  // Status card
  statusCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  statusLabel: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  statusValue: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: FontWeight.semibold,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.accent.red,
    flex: 1,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  calendarList: {
    paddingBottom: Spacing.xxl,
  },
  calendarItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.md,
  },
  calendarItemSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  calendarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  calendarColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: Spacing.md,
  },
  calendarDetails: {
    flex: 1,
  },
  calendarTitle: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  calendarTitleSelected: {
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
  calendarSource: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs / 2,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  modalFooter: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  modalSaveButton: {
    width: '100%',
  },
});
