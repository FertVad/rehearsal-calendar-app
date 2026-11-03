import React, { ReactNode } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, TouchTarget } from '../../../shared/constants/colors';
import { GlassButton } from '../../../shared/components';
import OnboardingProgress from './OnboardingProgress';
import { hapticLight } from '../../../shared/utils/haptics';
import { useI18n } from '../../../contexts/I18nContext';

interface OnboardingStepProps {
  title: string;
  description?: string;
  children: ReactNode;
  currentStep: number; // 0-based: 0, 1, 2
  totalSteps: number;
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  nextButtonTitle?: string; // Default: the translated "Next"
  nextButtonDisabled?: boolean;
  showBackButton?: boolean;
  /**
   * A quieter way past this step — "not now" rather than a refusal. It ends the
   * step's content, never the bar below: under the bar it lifted Back and Next
   * about 44 pt on its one step (T-022). `note` is a line under it.
   */
  secondaryAction?: { title: string; onPress: () => void; note?: string };
}

export default function OnboardingStep({
  title,
  description,
  children,
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSkip,
  nextButtonTitle,
  nextButtonDisabled = false,
  secondaryAction,
  showBackButton = true,
}: OnboardingStepProps) {
  const { t } = useI18n();
  const nextTitle = nextButtonTitle ?? t.onboarding.next;
  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Skip button */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        {onSkip && (
          <TouchableOpacity
            testID="onboarding-skip"
            onPress={() => {
              hapticLight();
              onSkip();
            }}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>{t.onboarding.skip}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress dots */}
      <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* One line, made smaller to fit: "Добро пожаловать, Нина!" is about
            402 pt at 32, and the iPhone 16 leaves 345 (T-022 review). */}
        <Text
          testID="onboarding-title"
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {title}
        </Text>
        {description && <Text style={styles.description}>{description}</Text>}
        <View style={styles.childrenContainer}>{children}</View>

        {secondaryAction && (
          <View style={styles.secondaryAction}>
            <GlassButton
              title={secondaryAction.title}
              onPress={() => {
                hapticLight();
                secondaryAction.onPress();
              }}
              variant="glass"
            />
            {secondaryAction.note && (
              <Text style={styles.secondaryActionNote}>{secondaryAction.note}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View testID="onboarding-footer" style={styles.footer}>
        {showBackButton && onBack ? (
          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <GlassButton
                title={t.common.back}
                onPress={() => {
                  hapticLight();
                  onBack();
                }}
                variant="glass"
              />
            </View>
            <View style={styles.buttonHalf}>
              <GlassButton
                title={nextTitle}
                onPress={() => {
                  hapticLight();
                  onNext?.();
                }}
                variant="purple"
                disabled={nextButtonDisabled}
              />
            </View>
          </View>
        ) : (
          <GlassButton
            title={nextTitle}
            onPress={() => {
              hapticLight();
              onNext?.();
            }}
            variant="purple"
            disabled={nextButtonDisabled}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  skipButton: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  childrenContainer: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonHalf: {
    flex: 1,
  },

  secondaryAction: {
    marginTop: 24,
    gap: 8,
  },
  secondaryActionNote: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
});
