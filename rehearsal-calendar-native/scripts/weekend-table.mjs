#!/usr/bin/env node
/**
 * Builds shared/contracts/weekends.json, the table of whose weekends are
 * which (T-406): a time zone gives a country by tzdata's zone.tab, a country
 * gives its weekend by CLDR's weekData.
 *
 *   node scripts/weekend-table.mjs                  write the table
 *   node scripts/weekend-table.mjs --check          the table is what this builds
 *   node scripts/weekend-table.mjs --cldr <supplementalData.xml>
 *                                                   the table against CLDR's own file
 *
 * Inputs:
 * - zone.tab: /usr/share/zoneinfo/zone.tab, or --zone-tab <file>; its tzdata
 *   version from +VERSION beside it, or --tzdata <version>.
 * - The weekend of each country from Node's ICU, whose weekData is CLDR's
 *   (process.versions.cldr). `--cldr` reads CLDR's supplementalData.xml of
 *   that version (common/supplemental/ in unicode-org/cldr, tag release-48)
 *   and compares every country in zone.tab and "001" with the table; it fails
 *   on the first difference.
 * - Zone names ICU knows that zone.tab does not (its older canonical names:
 *   Asia/Calcutta for Asia/Kolkata, Europe/Kiev for Europe/Kyiv) get the
 *   country of the zone.tab entry ICU resolves to the same zone. The app and the
 *   server also resolve a name through Intl before giving up (weekends.ts,
 *   weekendDefaults.js), so "Israel" or "W-SU" find their country too.
 *
 * Days are ISO weekdays: 1 Monday … 7 Sunday.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'shared/contracts/weekends.json');
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

const zoneTab = option('--zone-tab') ?? '/usr/share/zoneinfo/zone.tab';
const versionFile = path.join(path.dirname(zoneTab), '+VERSION');
const tzdata = option('--tzdata') ?? (existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : undefined);
if (!tzdata) throw new Error('The tzdata version of zone.tab is unknown: pass --tzdata <version>');

const zones = new Map();
for (const line of readFileSync(zoneTab, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [country, , zone] = line.split('\t');
  if (!/^[A-Z]{2}$/.test(country) || !zone) throw new Error(`zone.tab: unexpected line ${line}`);
  zones.set(zone, country);
}

const weekInfo = (region) => {
  const locale = new Intl.Locale(`und-${region}`);
  return (typeof locale.getWeekInfo === 'function' ? locale.getWeekInfo() : locale.weekInfo).weekend;
};
const icuCanonical = (zone) => new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;

const world = weekInfo('001');
const countries = [...new Set(zones.values())].sort();
const weekends = {};
for (const country of countries) {
  const days = weekInfo(country);
  if (days.join() !== world.join()) weekends[country] = days;
}

// ICU's names for the zones of zone.tab it calls otherwise.
const byIcuName = new Map([...zones].map(([zone, country]) => [icuCanonical(zone), country]));
const table = new Map(zones);
for (const zone of Intl.supportedValuesOf('timeZone')) {
  if (table.has(zone)) continue;
  const country = byIcuName.get(icuCanonical(zone));
  if (country) table.set(zone, country);
}

const built = {
  source: {
    zones: `tzdata ${tzdata}, zone.tab`,
    weekends: `CLDR ${process.versions.cldr}, supplementalData.xml weekData (weekendStart, weekendEnd), as ICU ${process.versions.icu} carries it`,
    aliases: `zone names of ICU ${process.versions.icu} that zone.tab does not list, by the zone.tab entry ICU resolves them to`,
    days: 'ISO weekdays: 1 Monday ... 7 Sunday',
    build: 'node scripts/weekend-table.mjs (rehearsal-calendar-native)',
  },
  world,
  weekends,
  zones: Object.fromEntries([...table].sort(([a], [b]) => (a < b ? -1 : 1))),
};
const text = `${JSON.stringify(built, null, 1)}\n`;

if (args.includes('--check')) {
  const committed = JSON.parse(readFileSync(output, 'utf8'));
  const same = JSON.stringify({ ...committed, source: undefined }) === JSON.stringify({ ...built, source: undefined });
  console.log(same ? 'weekends.json is what this builds' : 'weekends.json differs from what this builds');
  process.exit(same ? 0 : 1);
}

const cldrFile = option('--cldr');
if (cldrFile) {
  // CLDR's own words: <weekendStart day="fri" territories="AE BH ..."/> and
  // <weekendEnd day="sat" .../>; a territory not named takes "001"'s.
  const xml = readFileSync(cldrFile, 'utf8');
  const order = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
  const read = (tag) => {
    const days = new Map();
    for (const [, day, territories] of xml.matchAll(new RegExp(`<${tag}\\s+day="(\\w+)"\\s+territories="([^"]+)"`, 'g'))) {
      for (const territory of territories.trim().split(/\s+/)) days.set(territory, order[day]);
    }
    return days;
  };
  const starts = read('weekendStart');
  const ends = read('weekendEnd');
  const cldrWeekend = (territory) => {
    const start = starts.get(territory) ?? starts.get('001');
    const end = ends.get(territory) ?? ends.get('001');
    const days = [start];
    for (let day = start; day !== end; day = (day % 7) + 1) days.push((day % 7) + 1);
    return days.sort((a, b) => a - b);
  };
  const differences = [];
  if (cldrWeekend('001').join() !== world.join()) differences.push(`001: CLDR ${cldrWeekend('001')}, table ${world}`);
  for (const country of countries) {
    const ours = weekends[country] ?? world;
    if (cldrWeekend(country).join() !== [...ours].sort((a, b) => a - b).join()) {
      differences.push(`${country}: CLDR ${cldrWeekend(country)}, table ${ours}`);
    }
  }
  console.log(differences.length ? differences.join('\n')
    : `CLDR ${cldrFile}: all ${countries.length} countries of zone.tab and 001 as in the table`);
  process.exit(differences.length ? 1 : 0);
}

writeFileSync(output, text);
console.log(`${output}: ${table.size} zones, ${countries.length} countries, ${Object.keys(weekends).length} with another weekend than 001's ${world}`);
