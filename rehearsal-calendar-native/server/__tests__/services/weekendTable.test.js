/**
 * Whose weekends are which (T-406): the country of the profile's zone by
 * tzdata's zone.tab, the country's weekend by CLDR weekData — the table
 * shared/contracts/weekends.json, built by scripts/weekend-table.mjs.
 */
import { readFileSync } from 'node:fs';
import { weekendDaysOf, isoWeekday } from '../../services/availability/weekendDefaults.js';

const table = JSON.parse(readFileSync(new URL('../../../shared/contracts/weekends.json', import.meta.url), 'utf8'));

describe('the weekend of the country of the profile\'s zone', () => {
  it('Israel rests on Friday and Saturday', () => {
    expect(weekendDaysOf('Asia/Jerusalem')).toEqual([5, 6]);
  });

  it('Russia on Saturday and Sunday', () => {
    expect(weekendDaysOf('Europe/Moscow')).toEqual([6, 7]);
  });

  it('India has one day, Sunday, as CLDR says; by either name of its zone', () => {
    expect(weekendDaysOf('Asia/Kolkata')).toEqual([7]);
    expect(weekendDaysOf('Asia/Calcutta')).toEqual([7]);
  });

  it('Saudi Arabia, not Israel, also rests on Friday and Saturday', () => {
    expect(weekendDaysOf('Asia/Riyadh')).toEqual([5, 6]);
  });

  it('a zone with no country is CLDR\'s "001": Saturday and Sunday', () => {
    for (const zone of ['UTC', 'Etc/UTC', 'Etc/GMT+3', 'Not/A_Zone', '', undefined]) {
      expect(weekendDaysOf(zone)).toEqual([6, 7]);
    }
  });

  it('an old name of a zone finds its country through the zone it stands for', () => {
    expect(weekendDaysOf('Israel')).toEqual([5, 6]);
    expect(weekendDaysOf('Asia/Tel_Aviv')).toEqual([5, 6]);
    expect(weekendDaysOf('W-SU')).toEqual([6, 7]);
  });

  it('names its sources and their versions', () => {
    expect(table.source.zones).toMatch(/^tzdata \d{4}[a-z], zone\.tab$/);
    expect(table.source.weekends).toMatch(/^CLDR \d+\.\d+, supplementalData\.xml weekData/);
    expect(table.world).toEqual([6, 7]);
  });
});

describe('the day of the week is the date\'s own, with no zone (CLAUDE.md 3)', () => {
  it('reads Friday 27 November 2026 as a Friday in any process zone', () => {
    // Jest runs in America/New_York, where new Date('2026-11-27') is the 26th.
    expect(isoWeekday('2026-11-27')).toBe(5);
    expect(isoWeekday('2026-11-29')).toBe(7);
    expect(isoWeekday('2026-11-30')).toBe(1);
  });
});

// The weekends are CLDR's as this Node's ICU carries them: where the versions
// agree, every country of the table answers here as in the table.
const sameCldr = table.source.weekends.startsWith(`CLDR ${process.versions.cldr},`);
(sameCldr ? describe : describe.skip)('the table is what ICU of the same CLDR version says', () => {
  it('for every country in zone.tab and for 001', () => {
    const icu = (region) => {
      const locale = new Intl.Locale(`und-${region}`);
      return (typeof locale.getWeekInfo === 'function' ? locale.getWeekInfo() : locale.weekInfo).weekend;
    };
    expect(icu('001')).toEqual(table.world);
    for (const country of new Set(Object.values(table.zones))) {
      expect([country, icu(country)]).toEqual([country, table.weekends[country] ?? table.world]);
    }
  });
});
