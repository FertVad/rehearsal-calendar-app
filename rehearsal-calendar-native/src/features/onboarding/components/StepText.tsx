import React from 'react';
import { Text, TextProps } from 'react-native';
import { useI18n } from '../../../contexts/I18nContext';
import { typeset } from '../../../shared/utils/typeset';

/**
 * A text of an onboarding step, typeset where iOS wraps it (T-412): no short
 * word left at a line's end, no line begun by a dash, "→" or "…" — the
 * language's rule, from `typeset` — and the last line of a paragraph not one
 * word alone ("push-out").
 */
export default function StepText({ children, ...props }: Omit<TextProps, 'children'> & { children: string }) {
  const { language } = useI18n();
  return (
    <Text lineBreakStrategyIOS="push-out" {...props}>
      {typeset(children, language)}
    </Text>
  );
}
