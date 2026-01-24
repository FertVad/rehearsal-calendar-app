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
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
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
    color: Colors.text.onPrimary,
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
});
