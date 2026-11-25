import React, { ReactNode } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, FontSize, FontWeight, TouchTarget } from '../../../shared/constants/colors';
import { GlassButton } from '../../../shared/components';
import OnboardingProgress from './OnboardingProgress';
import StepText from './StepText';
import { hapticLight } from '../../../shared/utils/haptics';
import { typeset } from '../../../shared/utils/typeset';
import { useI18n } from '../../../contexts/I18nContext';

/** An answer to a step: it is what takes the step on. */
interface StepAnswer {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

interface OnboardingStepProps {
  title: string;
  /**
   * How many lines the title may take before it is made smaller. One for a
   * name or a greeting (T-022); a question has its lines (T-408, T-412).
   */
  titleLines?: number;
  /** How small the title may be made to fit its lines, of its 32 pt. */
  titleMinimumScale?: number;
  description?: string;
  children: ReactNode;
  currentStep: number; // 0-based
  totalSteps: number;
  /** "‹ Back" at the top left, on every step that has a way back. */
  onBack?: () => void;
  onSkip?: () => void;
  /** The step's main answer: purple, the whole width, at the bottom. */
  answer?: StepAnswer;
  /** Its other answer, right under it: grey, the whole width; `note` under both. */
  secondAnswer?: StepAnswer & { note?: string };
}

/**
 * One design for every step (T-412, the owner: "Все должно быть в одном
 * дизайне и понятно"). At the top, "‹ Back" on the left — on every step but
 * the greeting — and "Skip" on the right. At the bottom, the step's answers
 * together, one right under the other, the main one first, and nothing else:
 * no "Next" — an answer is what goes on — and no answer in the content or
 * beside Back. A step with two answers lifts its purple one higher than a
 * step with one; that came with the layout. T-022 kept a second answer out of
 * the bar because it lifted Back and Next there; Back is at the top now.
 */
export default function OnboardingStep({
  title,
  titleLines = 1,
  titleMinimumScale = 0.5,
  description,
  children,
  currentStep,
  totalSteps,
  onBack,
  onSkip,
  answer,
  secondAnswer,
}: OnboardingStepProps) {
  const { t, language } = useI18n();
  const press = (handler: () => void) => () => {
    hapticLight();
    handler();
  };
  return (
    <SafeAreaView style={styles.container}>
      <View testID="onboarding-header" style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            testID="onboarding-back"
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            onPress={press(onBack)}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.text.secondary} />
            <Text style={styles.headerText}>{t.common.back}</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        {onSkip && (
          <TouchableOpacity
            testID="onboarding-skip"
            accessibilityRole="button"
            accessibilityLabel={t.onboarding.skip}
            onPress={press(onSkip)}
            style={styles.skipButton}
          >
            <Text style={styles.headerText}>{t.onboarding.skip}</Text>
          </TouchableOpacity>
        )}
      </View>

      <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />

      <ScrollView
        testID="onboarding-content"
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* A greeting is one line, made smaller to fit: "Добро пожаловать,
            Нина!" is about 402 pt at 32, and the iPhone 16 leaves 345 (T-022
            review). A question has its lines, each whole: made smaller until
            the longest fits, never wrapped inside (T-408, T-412). */}
        <StepText
          testID="onboarding-title"
          style={styles.title}
          numberOfLines={titleLines}
          adjustsFontSizeToFit
          minimumFontScale={titleMinimumScale}
        >
          {title}
        </StepText>
        {description && <StepText style={styles.description}>{description}</StepText>}
        <View style={styles.childrenContainer}>{children}</View>
      </ScrollView>

      {(answer || secondAnswer) && (
        <View testID="onboarding-footer" style={styles.footer}>
          {answer && (
            <GlassButton
              testID="onboarding-answer"
              title={typeset(answer.title, language)}
              onPress={press(answer.onPress)}
              variant="purple"
              disabled={answer.disabled}
            />
          )}
          {secondAnswer && (
            <GlassButton
              testID="onboarding-second-answer"
              title={typeset(secondAnswer.title, language)}
              onPress={press(secondAnswer.onPress)}
              variant="glass"
              disabled={secondAnswer.disabled}
            />
          )}
          {secondAnswer?.note && (
            <StepText testID="onboarding-answer-note" style={styles.note}>
              {secondAnswer.note}
            </StepText>
          )}
        </View>
      )}
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
  backButton: {
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 12,
  },
  skipButton: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  headerText: {
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
    gap: 12,
  },
  note: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
});
