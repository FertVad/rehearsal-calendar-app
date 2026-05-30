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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },

  // Current Subscription Card
  currentSubscriptionCard: {
    backgroundColor: Colors.accent.purpleAlpha10,
    borderWidth: 1,
    borderColor: Colors.accent.purple,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  subscriptionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.accent.purple,
  },
  subscriptionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  subscriptionInfoLabel: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  subscriptionInfoValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  cancelButton: {
    marginTop: Spacing.md,
  },

  // Plans Section
  plansSection: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },

  // Plan Card
  planCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  planHeader: {
    marginBottom: Spacing.lg,
  },
  planName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  planPrice: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.accent.purple,
  },
  planPeriod: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.normal,
    color: Colors.text.secondary,
    textAlign: 'right',
    marginTop: Spacing.xs / 2,
  },
  planPriceInterval: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.normal,
    color: Colors.text.secondary,
  },

  // Features
  planFeatures: {
    marginBottom: Spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  featureText: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    flex: 1,
  },

  // Buttons
  selectPlanButton: {
    marginTop: Spacing.sm,
  },
  currentPlanBadge: {
    backgroundColor: Colors.accent.purple,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  currentPlanText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#ffffff',
  },

  // WebView Modal
  webViewContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  webViewTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg.primary,
  },

  // Management View
  managementContainer: {
    flex: 1,
  },
  viewPlansButton: {
    marginTop: Spacing.xl,
  },

  // Payment History Section
  paymentHistorySection: {
    marginTop: Spacing.xl,
  },
  paymentHistoryTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },

  // Payment Card
  paymentCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  paymentAmount: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  paymentDate: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs / 2,
  },

  // Status Badges
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusRefunded: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },

  // Status Text
  statusTextCompleted: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: 'rgb(34, 197, 94)',
  },
  statusTextPending: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: 'rgb(245, 158, 11)',
  },
  statusTextFailed: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: 'rgb(239, 68, 68)',
  },
  statusTextRefunded: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: 'rgb(59, 130, 246)',
  },

  // Payment Details
  paymentDetails: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  paymentDetailLabel: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    marginRight: Spacing.md,
  },
  paymentDetailValue: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: FontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyStateIcon: {
    marginBottom: Spacing.md,
  },
  emptyStateText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
