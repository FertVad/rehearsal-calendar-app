/**
 * T-243 — a failed planner load says why in the language on screen now.
 *
 * The hook kept the reason as text, translated with `t` the moment the load
 * failed, and the effect that wrote it did not list `t`: switched to Russian
 * on the profile tab with the planner left open behind it, the planner still
 * said "Server unavailable" in English. Listing `t` would only have loaded the
 * planner again on a change of language; the failure itself is kept instead,
 * and put into words on each render, as everywhere else (T-228).
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { translations } from '../../../../i18n/translations';
import { projectsAPI } from '../../../../shared/services/api';
import SmartPlannerScreen from '../SmartPlannerScreen';

let mockLanguage: 'en' | 'ru' = 'en';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../../../shared/utils/logger', () => ({
  logger: { debug: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: require('../../../../i18n/translations').translations[mockLanguage],
    language: mockLanguage,
  }),
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', timezone: 'UTC' } }),
}));
jest.mock('../../../../contexts/ProjectContext', () => ({
  useProjects: () => ({
    projects: [{ id: 'A', name: 'Project A', is_admin: true, timezone: 'UTC', created_at: '2026-01-01T00:00:00Z' }],
  }),
}));
jest.mock('../../../../hooks/useWeekStart', () => ({ useWeekStart: () => 'monday' }));
jest.mock('../../../../shared/services/api', () => ({
  projectsAPI: {
    getProject: jest.fn(),
    getMembers: jest.fn(),
    getMembersAvailabilityRange: jest.fn(),
  },
}));
jest.mock('../../../../shared/hooks/useClock', () => ({
  useNow: () => new Date('2026-01-01T08:00:00Z'),
  useToday: () => '2026-01-01',
  useTimezone: () => 'UTC',
}));

const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

const props = {
  route: { params: { projectId: 'A' }, key: 'planner', name: 'SmartPlanner' } as any,
  navigation: { setParams: jest.fn(), goBack: jest.fn() } as any,
};

beforeEach(() => {
  mockLanguage = 'en';
  // The server answered 503: "unavailable", in whichever language is on.
  const down = Object.assign(new Error('Request failed with status code 503'), {
    response: { status: 503, data: {} },
  });
  (projectsAPI.getProject as jest.Mock).mockRejectedValue(down);
  (projectsAPI.getMembers as jest.Mock).mockRejectedValue(down);
  (projectsAPI.getMembersAvailabilityRange as jest.Mock).mockRejectedValue(down);
});

it('a failed load is told in the language switched to while it is on screen', async () => {
  const screen = render(<SmartPlannerScreen {...props} />);
  await settle();
  await settle();
  expect(screen.getByText(translations.en.common.serverUnavailable)).toBeTruthy();

  mockLanguage = 'ru';
  screen.rerender(<SmartPlannerScreen {...props} />);
  await settle();

  expect(screen.getByText(translations.ru.smartPlanner.errorLoading)).toBeTruthy();
  expect(screen.getByText(translations.ru.common.serverUnavailable)).toBeTruthy();
  expect(screen.queryByText(translations.en.common.serverUnavailable)).toBeNull();
  // Not loaded again for it: a change of language is not a new question.
  expect(projectsAPI.getMembersAvailabilityRange).toHaveBeenCalledTimes(1);
});
