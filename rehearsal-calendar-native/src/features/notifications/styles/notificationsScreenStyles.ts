import { StyleSheet } from 'react-native';
import { Colors } from '../../../shared/constants/colors';
import { Spacing, BorderRadius } from '../../../shared/constants/spacing';
import { FontSize, FontWeight } from '../../../shared/constants/typography';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
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
  markAllButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  markAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.accent.purple,
  },

  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    backgroundColor: Colors.bg.secondary,
  },
  // Unread earns the accent; read fades back so the eye goes to what is new.
  cardUnread: {
    borderColor: Colors.accent.purple,
    backgroundColor: Colors.accent.purpleAlpha10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.primary,
  },
  body: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  cardTitleRead: {
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
  cardBody: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  cardTime: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: Colors.accent.purple,
  },

  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xxl * 3,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  emptyHint: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.text.secondary,
  },
  loading: {
    paddingTop: Spacing.xxl * 3,
  },
});
