import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../../contexts/I18nContext';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/colors';
import { APP_STORE_URL } from '../services/appUpdate';
import GlassButton from './buttons/GlassButton';

/**
 * Shown by the root of the navigation instead of the navigator, as the
 * session spinner is, while the server refuses this build as too old (T-265).
 * Not a Modal (CLAUDE.md, the details sheet) and nothing closes it: the only
 * way on is the App Store. It goes away by itself when the server answers this
 * build again.
 */
export function UpdateRequiredScreen() {
  const { t } = useI18n();
  return (
    <View style={styles.container} testID="update-required">
      <Ionicons name="arrow-up-circle-outline" size={64} color={Colors.accent.purple} />
      <Text style={styles.title} accessibilityRole="header">{t.update.title}</Text>
      <Text style={styles.message}>{t.update.message}</Text>
      <GlassButton
        testID="update-required-open-store"
        variant="purple"
        title={t.update.openStore}
        onPress={() => {
          Linking.openURL(APP_STORE_URL).catch(() => undefined);
        }}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.lg,
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  message: {
    color: Colors.text.secondary,
    fontSize: FontSize.lg,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    marginTop: Spacing.sm,
  },
});
