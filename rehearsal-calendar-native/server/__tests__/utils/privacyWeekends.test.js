/**
 * The privacy policy and the weekends busy by default (T-406). Part of a
 * person's busy days is now marked by the app, not by them: "As you mark
 * them" stopped being true. Each language says, where it lists what is kept,
 * that the weekends of the country of the time zone are marked busy by
 * default, and, where it says how to manage the data, where that is turned
 * off — the path as the Profile labels it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../../public/privacy.html', import.meta.url)), 'utf8');
const section = (lang) => html.match(new RegExp(`<section data-content="${lang}"[^>]*>([\\s\\S]*?)</section>`))[1];
const rows = (lang) => [...section(lang).matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g)]
  .map((match) => match.slice(1, 4));

const POLICY = {
  en: { availability: /^Your availability — busy and free periods\. Your weekends are marked busy by default: the days off of the country of your time zone, a year ahead, except days you mark yourself$/,
    when: 'As you mark them; the weekends by the app, unless you turn this off', wasWhen: 'As you mark them',
    zone: /whether your weekends are marked busy by default/,
    right: '<li><strong>Stop marking your weekends busy</strong> — Profile → Weekends Busy. This removes the weekends marked by default from today on; days you marked yourself stay.</li>' },
  ru: { availability: /^Ваша занятость — когда вы заняты и когда свободны\. Выходные по умолчанию отмечаются занятыми: выходные дни страны вашего часового пояса, на год вперёд, кроме дней, которые вы отметили сами$/,
    when: 'По мере заполнения; выходные — приложением, если вы это не выключили', wasWhen: 'По мере заполнения',
    zone: /отмечать ли ваши выходные занятыми по умолчанию/,
    right: '<li><strong>Не отмечать выходные занятыми</strong> — Профиль → Выходные заняты. Отметки выходных по умолчанию удалятся начиная с сегодняшнего дня; то, что вы отметили сами, останется.</li>' },
  es: { availability: /^Tu disponibilidad — horas libres y ocupadas\. Tus fines de semana se marcan como ocupados por defecto: los días de descanso del país de tu zona horaria, con un año de antelación, salvo los días que marques tú$/,
    when: 'A medida que las marcas; los fines de semana, la aplicación, salvo que lo desactives', wasWhen: 'A medida que las marcas',
    zone: /si tus fines de semana se marcan como ocupados por defecto/,
    right: '<li><strong>Dejar de marcar tus fines de semana como ocupados</strong> — Perfil → Fines de semana ocupados. Se eliminan los fines de semana marcados por defecto a partir de hoy; los días que marcaste tú se mantienen.</li>' },
  de: { availability: /^Deine Verfügbarkeit – freie und belegte Zeiträume\. Deine Wochenenden werden standardmäßig als belegt markiert: die freien Tage des Landes deiner Zeitzone, ein Jahr im Voraus, außer an Tagen, die du selbst einträgst$/,
    when: 'Sobald du sie einträgst; die Wochenenden die App, solange du das nicht ausschaltest', wasWhen: 'Sobald du sie einträgst',
    zone: /ob deine Wochenenden standardmäßig als belegt markiert werden/,
    right: '<li><strong>Wochenenden nicht mehr als belegt markieren</strong> – Profil → Wochenenden belegt. Die standardmäßig markierten Wochenenden ab heute werden entfernt; was du selbst eingetragen hast, bleibt.</li>' },
};

describe.each(Object.keys(POLICY))('the policy in %s (T-406)', (lang) => {
  const policy = POLICY[lang];

  it('says the weekends are marked busy by default, and by whom', () => {
    const row = rows(lang).find(([what]) => policy.availability.test(what));
    expect(row).toBeDefined();
    expect(row[2]).toBe(policy.when);
    expect(rows(lang).some(([, , when]) => when === policy.wasWhen)).toBe(false);
  });

  it('keeps the switch with the time zone, which tells the weekend days', () => {
    expect(rows(lang).some(([what]) => policy.zone.test(what))).toBe(true);
  });

  it('says where it is turned off, by the Profile\'s label, among the rights', () => {
    expect(section(lang)).toContain(policy.right);
  });
});
