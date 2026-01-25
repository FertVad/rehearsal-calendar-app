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
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  userCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    marginBottom: Spacing.md,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.purple,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  userEmail: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.purple,
  },
  editProfileText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
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
  },
  settingValue: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  logoutButton: {
    marginTop: Spacing.lg,
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
  timezoneList: {
    paddingBottom: Spacing.xxl,
  },
  weekStartOptions: {
    paddingBottom: Spacing.xl,
  },
  timezoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.md,
  },
  timezoneItemSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  timezoneLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  timezoneLabelSelected: {
    fontWeight: FontWeight.semibold,
    color: Colors.accent.purple,
  },
});
