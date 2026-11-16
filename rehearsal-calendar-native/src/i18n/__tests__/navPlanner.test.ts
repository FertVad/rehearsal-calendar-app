/**
 * The Planner tab's label and its screen's large title are one string,
 * t.nav.planner. It is "Planner" in every language, as "Smart Planner" is:
 * the owner's decision (Vadim, 11.11.2026, T-249), said twice. T-032 had
 * translated it ("Планер", "Planificador", "Planer") on a review's word —
 * that was the defect, not the fix. Do not translate it again.
 */
import { translations } from '../translations';

describe('the Planner tab is "Planner" in every language', () => {
  it.each(Object.keys(translations))('%s', (language) => {
    const t = translations[language as keyof typeof translations];
    expect(t.nav.planner).toBe('Planner');
    expect(t.smartPlanner.title).toBe('Smart Planner');
  });
});
