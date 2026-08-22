import React, { ReactNode } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, BorderRadius } from '../../../shared/constants/colors';
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
  nextButtonTitle?: string; // Default: "Next", last screen: "Finish"
  nextButtonDisabled?: boolean;
  showBackButton?: boolean;
  /** A quieter way past this step — "not now" rather than a refusal. */
  secondaryAction?: { title: string; onPress: () => void };
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
  nextButtonTitle = 'Next',
  nextButtonDisabled = false,
  secondaryAction,
  showBackButton = true,
}: OnboardingStepProps) {
  const { t } = useI18n();
  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Skip button */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        {onSkip && (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              onSkip();
            }}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip</Text>
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
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
        <View style={styles.childrenContainer}>{children}</View>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.footer}>
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
                title={nextButtonTitle}
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
            title={nextButtonTitle}
            onPress={() => {
              hapticLight();
              onNext?.();
            }}
            variant="purple"
            disabled={nextButtonDisabled}
          />
        )}

        {secondaryAction && (
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => {
              hapticLight();
              secondaryAction.onPress();
            }}
          >
            <Text style={styles.secondaryActionText}>{secondaryAction.title}</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
});
