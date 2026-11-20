import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors, FontSize, Spacing, TouchTarget } from '../../../shared/constants/colors';
import { useI18n } from '../../../contexts/I18nContext';
import { privacyPageUrl } from '../../../shared/services/api';

/**
 * The privacy policy, in the app's language, at the foot of sign-in and
 * registration (T-272): the form takes a name and an address before there is
 * an account, and App Review 5.1.1(i) wants the policy easily reached there,
 * not only from the profile. Quiet text, with a 44 pt target.
 */
export default function PrivacyPolicyLink({ testID }: { testID: string }) {
  const { t, language } = useI18n();
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="link"
      style={styles.link}
      onPress={() => Linking.openURL(privacyPageUrl(language))}
    >
      <Text style={styles.text}>{t.profile.privacyPolicy}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center',
    minHeight: TouchTarget,
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  text: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    textDecorationLine: 'underline',
  },
});
