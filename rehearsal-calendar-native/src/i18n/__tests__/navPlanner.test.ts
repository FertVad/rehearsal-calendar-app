/**
 * The Planner tab's label and its screen's large title are one string,
 * t.nav.planner (T-032). It was left in English in every language, so the
 * Russian tab read "Planner".
 */
import { translations } from '../translations';

describe('the Planner tab is named in each language', () => {
  it.each([
    ['ru', 'Планер'],
    ['en', 'Planner'],
    ['es', 'Planificador'],
    ['de', 'Planer'],
  ] as const)('%s: %s', (language, name) => {
    expect(translations[language].nav.planner).toBe(name);
  });
});
