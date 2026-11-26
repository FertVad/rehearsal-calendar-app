/**
 * Every onboarding step in one design, in every language (T-412, the owner:
 * "Все шаги онбординга нужно сделать в таком дизайне… Все должно быть в одном
 * дизайне и понятно"). The steps are the stack's own list, so a step added
 * later is walked here too:
 *
 * - at the top, "Skip" — and "‹ Back" on every step but the first;
 * - the answers only at the bottom, the purple one first; none in the content;
 * - no "Next";
 * - every text on screen typeset by its language's rule: no plain space after
 *   a short word the rule glues, nor before a dash, "→" or "…"
 *   (audit/evidence/T-412/natives.md, section 2).
 */
import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor, within } from '@testing-library/react-native';
import { ONBOARDING_STEPS } from '../navigation/steps';
import GlassButton from '../../../shared/components/buttons/GlassButton';
import { getDeviceCalendars } from '../../../shared/services/calendar';
import { translations } from '../../../i18n/translations';

type Lang = 'ru' | 'en' | 'es' | 'de';
const LANGS: Lang[] = ['ru', 'en', 'es', 'de'];
const mockLanguage = { current: 'en' as Lang };

jest.mock('../../../shared/components', () => ({
  GlassButton: jest.requireActual('../../../shared/components/buttons/GlassButton').default,
  UserAvatar: () => null,
}));
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../i18n/translations').translations[mockLanguage.current], language: mockLanguage.current }),
}));
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Nina', lastName: 'Newcomer' }, updateUser: jest.fn() }),
}));
jest.mock('../hooks/useOnboarding', () => ({
  useOnboarding: () => ({ skipOnboarding: jest.fn(), completeOnboarding: jest.fn(), isCompleting: false }),
}));
jest.mock('../../../shared/services/api', () => ({ availabilityAPI: { setWeekends: jest.fn() }, projectsAPI: {}, rehearsalsAPI: {} }));
jest.mock('../../../shared/hooks/useClock', () => ({ useTimezone: () => 'Europe/Moscow' }));
jest.mock('../../../shared/services/notifications', () => ({ askAndRegisterPush: jest.fn() }));
jest.mock('../../../shared/utils/calendarMappings', () => ({ getAllMappings: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../shared/services/calendar', () => ({
  checkCalendarPermissions: jest.fn().mockResolvedValue(true),
  requestCalendarPermissions: jest.fn().mockResolvedValue(true),
  getDeviceCalendars: jest.fn(),
  getDefaultCalendar: jest.fn().mockResolvedValue(null),
  importCalendarEventsToAvailability: jest.fn(),
  syncAllRehearsals: jest.fn(),
  removeAllExportedEvents: jest.fn(),
  removeAllImportedSlots: jest.fn(),
  syncRehearsalToCalendar: jest.fn(),
  unsyncRehearsal: jest.fn(),
}));

const HOME = { id: 'cal-1', title: 'Home', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } };
const WORK = { id: 'cal-2', title: 'Work', allowsModifications: true, source: { name: 'iCloud', type: 'caldav' } };

beforeEach(async () => {
  (getDeviceCalendars as jest.Mock).mockResolvedValue([HOME, WORK]);
  await AsyncStorage.clear();
});

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

/** A step on screen, once what it reads on opening is in. */
const open = async (index: number, language: Lang) => {
  mockLanguage.current = language;
  const { component: Step } = ONBOARDING_STEPS[index];
  const view = render(<Step navigation={navigation} route={{}} />);
  // The calendar step reads its access and calendars first.
  if (ONBOARDING_STEPS[index].name === 'CalendarSync') {
    await waitFor(() => view.getByText(translations[language].onboarding.calendarSync.apple));
  }
  return view;
};

const textsOf = (view: ReturnType<typeof render>) =>
  view.UNSAFE_getAllByType(Text).map((node) => [node.props.children].flat().filter((c) => typeof c === 'string').join(''));

it('walks five steps, the stack\'s own', () => {
  expect(ONBOARDING_STEPS.map((step) => step.name)).toEqual(['Welcome', 'Weekends', 'CalendarSync', 'Notifications', 'WhatWhere']);
});

describe.each(LANGS)('in %s', (language) => {
  const t = translations[language];

  it.each(ONBOARDING_STEPS.map((step, index) => [step.name, index] as const))(
    '%s: Skip and Back at the top, its answers only at the bottom, the main one first, no Next',
    async (_name, index) => {
      const view = await open(index, language);

      const header = view.getByTestId('onboarding-header');
      expect(within(header).getByText(t.onboarding.skip)).toBeTruthy();
      if (index === 0) expect(view.queryByText(t.common.back)).toBeNull();
      else expect(within(header).getByText(t.common.back)).toBeTruthy();

      // Every answer is a button of the bottom bar, the purple one first.
      const footer = view.getByTestId('onboarding-footer');
      const answers = view.UNSAFE_getAllByType(GlassButton);
      expect(answers.length).toBeGreaterThan(0);
      expect(within(footer).UNSAFE_getAllByType(GlassButton)).toHaveLength(answers.length);
      expect(within(view.getByTestId('onboarding-content')).UNSAFE_queryAllByType(GlassButton)).toHaveLength(0);
      // The purple one first; a grey one under it — or alone, where the
      // answer is a calendar picked in the card.
      expect(['purple', 'purple glass', 'glass']).toContain(answers.map((answer) => answer.props.variant).join(' '));
      expect(within(footer).queryByText(t.common.back)).toBeNull();

      expect(textsOf(view).filter((text) => /^(Next|Далее|Siguiente|Weiter)$/.test(text))).toEqual([]);
    },
  );
});

// What the rule glues, per language, written out here rather than taken from
// typeset(): a plain space where a no-break one belongs.
const UNGLUED: Record<Lang, RegExp[]> = {
  ru: [
    /(?<![\p{L}\p{N}])(в|к|о|с|у|во|ко|об|со|до|за|из|на|от|по|а|и|да|но|то|не|ни|ну|уж|аж) /iu,
    / (ли|же|ж|бы|б)(?![\p{L}\p{N}])/u,
    / [—→…]/u,
  ],
  en: [/(?<![\p{L}\p{N}’'])(a|A|I) /u, / [—→…]/u],
  es: [/(?<![\p{L}\p{N}])(a|y|e|o|u|A|Y|E|O|U) /u, / [—→…]/u],
  de: [/ [–—→…]/u, /\p{N} \p{L}/u],
};

describe.each(LANGS)('typeset in %s', (language) => {
  it.each(ONBOARDING_STEPS.map((step, index) => [step.name, index] as const))('%s', async (_name, index) => {
    const view = await open(index, language);
    const wrong = textsOf(view).filter((text) => UNGLUED[language].some((rule) => rule.test(text)));
    expect(wrong).toEqual([]);
  });

  it('the calendar step without access, and with its list open', async () => {
    const calendar = require('../../../shared/services/calendar');
    calendar.checkCalendarPermissions.mockResolvedValueOnce(false);
    mockLanguage.current = language;
    const Step = ONBOARDING_STEPS.find((step) => step.name === 'CalendarSync')!.component;
    const view = render(<Step navigation={navigation} route={{}} />);
    await waitFor(() => view.getByText(translations[language].onboarding.calendarSync.grantPermission));
    expect(textsOf(view).filter((text) => UNGLUED[language].some((rule) => rule.test(text)))).toEqual([]);
  });
});
