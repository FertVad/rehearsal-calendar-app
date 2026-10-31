import { StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '../../../shared/constants/colors';
import { AUTH_BUTTON_HEIGHT } from '../../../shared/constants/spacing';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.xl,
  },
  // The form in the middle of the screen, the way to registration at its foot.
  main: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl * 2,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    minHeight: 44,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: Colors.accent.red,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: Colors.accent.red,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  passwordGroup: {
    marginBottom: Spacing.sm,
  },
  // Links are text, with a 44 pt target.
  forgotLink: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  registerLink: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  linkText: {
    color: Colors.accent.purple,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  loginButton: {
    height: AUTH_BUTTON_HEIGHT,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.glass.border,
  },
  dividerText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginHorizontal: Spacing.md,
  },
  oauthContainer: {
    marginTop: Spacing.lg,
  },
  oauthButton: {
    marginBottom: Spacing.sm,
  },
  // Apple mandates its own button styling for Sign in with Apple, so this
  // only controls the footprint — the height of the other two, so the
  // buttons line up.
  appleButton: {
    width: '100%',
    height: AUTH_BUTTON_HEIGHT,
    marginBottom: Spacing.sm,
  },
});
