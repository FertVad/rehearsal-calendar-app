/**
 * The privacy policy and the weekends busy by default (T-406), in the words
 * of the native speakers of ru, en, es and de (T-408). Part of a person's busy
 * days is marked by Rehearsly, not by them: "As you mark them" stopped being
 * true. Each language says, where it lists what is kept, which days are
 * marked and for how long, and, where it says how to manage the data, where
 * that is turned off — the path as the Profile labels it — and what goes then.
 *
 * What each edit of T-408 was for, checked in every language:
 * - М1: "days off", «выходные дни страны», "días de descanso", "freie Tage"
 *   read as the public holidays too; only the weekly weekend by CLDR is marked
 *   (services/availability/weekendDefaults.js, shared/contracts/weekends.json).
 * - М2: "con un año de antelación" and "ein Jahr im Voraus" mean "a year
 *   before"; it is the next 12 months, laid out on a rolling basis
 *   (HORIZON_DAYS, ensureWeekendDefaults on every read).
 * - М3: Rehearsly marks them — the server, for those who have never opened
 *   the app too (routes/native/members.js) — not "the app".
 * - М4: turning it off removes the defaults for today and every later day at
 *   once; earlier days and the person's own marks stay (setWeekendsBusy).
 * - М5: the switch is not "detected": it is on for everyone by default.
 * - М6: the time zone row says what the switch is for.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../../public/privacy.html', import.meta.url)), 'utf8');
const section = (lang) => html.match(new RegExp(`<section data-content="${lang}"[^>]*>([\\s\\S]*?)</section>`))[1];
const rows = (lang) => [...section(lang).matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g)]
  .map((match) => match.slice(1, 4));

// Each row by the start of its first cell, as the table has it.
const POLICY = {
  en: {
    zoneRow: 'Time zone,',
    zone: ['Time zone, language, first day of the week, and whether your weekends are marked busy by default',
      'To show times and dates correctly; your time zone also tells us which days are your weekend, and your weekend setting tells us whether to mark them busy',
      'Set automatically, changeable in the app'],
    availabilityRow: 'Your availability',
    availability: ['Your availability — busy and free periods. By default, your weekends are marked busy for the next 12 months on a rolling basis, except days you mark yourself. Your weekends are the weekend days of the country your time zone belongs to, not its public holidays',
      'To suggest times that suit everyone',
      'As you mark them; your weekends are marked by Rehearsly unless you turn this off'],
    right: '<li><strong>Stop marking your weekends busy</strong> — Profile → Mark Weekends as Busy. This removes the default busy marks for today and all later days; earlier days and days you marked yourself stay as they are.</li>',
    weekly: /weekend days of the country.*not its public holidays/, notDaysOff: /days off/,
    twelve: /next 12 months on a rolling basis/, notYear: /a year ahead/,
    byWhom: /by Rehearsly/, notApp: /by the app/,
    removed: /for today and all later days; earlier days and days you marked yourself stay/,
    notDetected: /detected/, purpose: /your weekend setting tells us whether to mark them busy/,
  },
  ru: {
    zoneRow: 'Часовой пояс,',
    zone: ['Часовой пояс, язык, начало недели и настройка, отмечать ли ваши выходные занятыми по умолчанию',
      'Правильно показывать даты и время; по часовому поясу определяется, какие дни недели у вас выходные, а по настройке — отмечать ли их занятыми',
      'Задаются автоматически, меняются в приложении'],
    availabilityRow: 'Ваша занятость',
    availability: ['Ваша занятость — когда вы заняты и когда свободны. По умолчанию еженедельные выходные страны вашего часового пояса отмечаются у вас занятыми на ближайшие 12 месяцев, кроме дней, которые вы отметили сами',
      'Подбор времени, удобного всем',
      'По мере заполнения; выходные отмечает Rehearsly, если вы это не выключили'],
    right: '<li><strong>Не отмечать выходные занятыми</strong> — Профиль → Выходные заняты. Отметки по умолчанию на сегодня и на все следующие дни сразу удалятся, а на прошедшие дни останутся, как и всё, что вы отметили сами.</li>',
    weekly: /еженедельные выходные страны/, notDaysOff: /выходные дни страны/,
    twelve: /на ближайшие 12 месяцев/, notYear: /на год вперёд/,
    byWhom: /отмечает Rehearsly/, notApp: /приложением/,
    removed: /на сегодня и на все следующие дни сразу удалятся, а на прошедшие дни останутся, как и всё, что вы отметили сами/,
    notDetected: /Определяются/, purpose: /по настройке — отмечать ли их занятыми/,
  },
  es: {
    zoneRow: 'Zona horaria,',
    zone: ['Zona horaria, idioma, inicio de la semana y si tus fines de semana se marcan como ocupados por defecto',
      'Mostrar fechas y horas correctamente; tu zona horaria indica también qué días forman tu fin de semana, y el ajuste, si hay que marcarlos como ocupados',
      'Se configura automáticamente y se puede cambiar en la aplicación'],
    availabilityRow: 'Tu disponibilidad',
    availability: ['Tu disponibilidad — horas libres y ocupadas. Por defecto, tus fines de semana se marcan como ocupados durante los próximos 12 meses, salvo los días que marques tú. Tu fin de semana es el del país de tu zona horaria; los festivos no se marcan',
      'Proponer horarios que convengan a todos',
      'A medida que las marcas; tus fines de semana los marca Rehearsly, salvo que lo desactives'],
    right: '<li><strong>Dejar de marcar tus fines de semana como ocupados</strong> — Perfil → Fines de semana ocupados. Se eliminan las marcas por defecto de hoy y de los días siguientes; las de días anteriores se mantienen, igual que todo lo que marcaste tú.</li>',
    weekly: /los festivos no se marcan/, notDaysOff: /días de descanso/,
    twelve: /durante los próximos 12 meses/, notYear: /con un año de antelación/,
    byWhom: /los marca Rehearsly/, notApp: /la aplicación, salvo/,
    removed: /de hoy y de los días siguientes; las de días anteriores se mantienen, igual que todo lo que marcaste tú/,
    notDetected: /Se detecta/, purpose: /el ajuste, si hay que marcarlos como ocupados/,
  },
  de: {
    zoneRow: 'Zeitzone,',
    zone: ['Zeitzone, Sprache, Wochenbeginn und ob deine Wochenenden standardmäßig als belegt markiert werden',
      'Datum und Uhrzeit korrekt anzeigen; anhand der Zeitzone bestimmen, auf welche Tage dein Wochenende fällt, und anhand deiner Einstellung, ob es als belegt markiert wird',
      'Automatisch festgelegt, jederzeit in der App änderbar'],
    availabilityRow: 'Deine Verfügbarkeit',
    availability: ['Deine Verfügbarkeit – freie und belegte Zeiträume. Deine Wochenenden, also die Wochenendtage des Landes deiner Zeitzone, werden standardmäßig für die jeweils nächsten 12 Monate als belegt markiert, außer an Tagen, die du selbst einträgst',
      'Termine vorschlagen, die allen passen',
      'Sobald du sie einträgst; die Wochenenden trägt Rehearsly automatisch ein, solange du das nicht ausschaltest'],
    right: '<li><strong>Wochenenden nicht mehr als belegt markieren</strong> – Profil → Wochenenden belegt. Schaltest du das aus, entfernt Rehearsly sofort die standardmäßig gesetzten Markierungen für heute und alle späteren Tage; vergangene Tage und alles, was du selbst eingetragen hast, bleiben unverändert.</li>',
    weekly: /die Wochenendtage des Landes deiner Zeitzone/, notDaysOff: /freien Tage/,
    twelve: /für die jeweils nächsten 12 Monate/, notYear: /ein Jahr im Voraus/,
    byWhom: /trägt Rehearsly automatisch ein/, notApp: /die App, solange/,
    removed: /sofort .* für heute und alle späteren Tage; vergangene Tage und alles, was du selbst eingetragen hast, bleiben unverändert/,
    notDetected: /erkannt/, purpose: /anhand deiner Einstellung, ob es als belegt markiert wird/,
  },
};

describe.each(Object.keys(POLICY))('the policy in %s (T-406, T-408)', (lang) => {
  const policy = POLICY[lang];
  const row = (start) => rows(lang).find(([what]) => what.startsWith(start));
  const zone = () => row(policy.zoneRow);
  const availability = () => row(policy.availabilityRow);
  // The right by its heading, which T-408 kept.
  const heading = policy.right.match(/<strong>[^<]*<\/strong>/)[0];
  const right = () => section(lang).split('\n').map((line) => line.trim()).find((line) => line.startsWith(`<li>${heading}`));

  it('the time zone row, cell by cell', () => {
    expect(zone()).toEqual(policy.zone);
  });

  it('the availability row, cell by cell', () => {
    expect(availability()).toEqual(policy.availability);
  });

  it('the right to stop it, by the Profile\'s label', () => {
    expect(right()).toBe(policy.right);
  });

  it('М1: only the weekly weekend of the zone\'s country is marked, not holidays', () => {
    expect(availability()[0]).toMatch(policy.weekly);
    expect(section(lang)).not.toMatch(policy.notDaysOff);
  });

  it('М2: for the next 12 months, not "a year before"', () => {
    expect(availability()[0]).toMatch(policy.twelve);
    expect(section(lang)).not.toMatch(policy.notYear);
  });

  it('М3: Rehearsly marks them, not the app', () => {
    expect(availability()[2]).toMatch(policy.byWhom);
    expect(availability()[2]).not.toMatch(policy.notApp);
  });

  it('М4: off removes the defaults from today on at once; earlier days and own marks stay', () => {
    expect(right()).toMatch(policy.removed);
  });

  it('М5: the switch is set for everyone, not detected', () => {
    expect(zone()[2]).not.toMatch(policy.notDetected);
  });

  it('М6: the time zone row says what the switch is for', () => {
    expect(zone()[1]).toMatch(policy.purpose);
  });

  it('no cell ends with a full stop, as its neighbours', () => {
    expect([...zone(), ...availability()].filter((cell) => cell.endsWith('.'))).toEqual([]);
  });
});
