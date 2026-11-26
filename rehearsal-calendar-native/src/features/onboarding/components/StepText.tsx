import React from 'react';
import { Text, TextProps } from 'react-native';
import { useI18n } from '../../../contexts/I18nContext';
import { typeset } from '../../../shared/utils/typeset';

/**
 * A text of an onboarding step, typeset where iOS wraps it (T-412): no short
 * word left at a line's end, no line begun by a dash, "→" or "…" — the
 * language's rule, from `typeset`.
 *
 * "push-out" does not keep a paragraph's last line from being one word alone
 * (T-417: es "…que / administras" was set with it). What keeps the words of a
 * group by its sense on one line are the no-break spaces the native speakers
 * put in the strings themselves; "push-out" stays as iOS's own help.
 */
export default function StepText({ children, ...props }: Omit<TextProps, 'children'> & { children: string }) {
  const { language } = useI18n();
  return (
    <Text lineBreakStrategyIOS="push-out" {...props}>
      {typeset(children, language)}
    </Text>
  );
}
