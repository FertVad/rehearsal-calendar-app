/**
 * The form's month opens in every language of the app (T-018 review). The
 * calendars set the app's language as react-native-calendars' default, and
 * the library threw on one it had no words for — `dayNamesShort` of
 * undefined in Spanish and German. The app's mock of the library has no
 * locales of its own to miss, so the real library is drawn here.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { translations, Language } from '../../../i18n/translations';

jest.mock('react-native-calendars', () => ({
  Calendar: jest.requireActual('react-native-calendars/src/calendar/index.js').default,
  LocaleConfig: jest.requireActual('xdate'),
}));
jest.mock('react-native-calendars/src/calendar/img/previous.png', () => 1);
jest.mock('react-native-calendars/src/calendar/img/next.png', () => 2);
// Untranspiled; the month is drawn without its swipes.
jest.mock('react-native-swipe-gestures', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
});
// The library's day reads the writing direction when it loads, and its month
// announces itself (the app's mock of react-native has neither).
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    TouchableWithoutFeedback: actual.TouchableOpacity,
    I18nManager: { isRTL: false },
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
  };
});
let mockLanguage: Language = 'en';
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: { common: { today: 'Today' } }, language: mockLanguage }),
}));
jest.mock('../../../hooks/useWeekStart', () => ({ useWeekStart: () => 'monday' }));
jest.mock('../../hooks/useClock', () => ({ useToday: () => '2026-11-01' }));

import { DayCalendar } from '../DayCalendar';

const NOVEMBER: Record<Language, string> = {
  ru: 'Ноябрь',
  en: 'November',
  es: 'Noviembre',
  de: 'November',
};
const MONDAY: Record<Language, string> = { ru: 'Пн', en: 'M', es: 'L', de: 'Mo' };

describe('DayCalendar in every language', () => {
  it.each(Object.keys(translations) as Language[])('opens in %s, its month in its words', (language) => {
    mockLanguage = language;
    const view = render(<DayCalendar value="2026-11-05" onChange={jest.fn()} testID="day-calendar" />);
    expect(view.getByTestId('day-calendar.header.title', { includeHiddenElements: true }))
      .toHaveTextContent(new RegExp(`^${NOVEMBER[language]}\\s2026$`));
    // The week begins on Monday, named in its words.
    expect(view.getByTestId(`day-calendar.header.dayName_${MONDAY[language]}`, { includeHiddenElements: true })).toBeTruthy();
  });
});
