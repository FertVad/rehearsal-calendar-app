/**
 * T-413: the native speakers' final words for what deleting the account does to
 * the calendar (T-409). The line is where an event was added, not which device's
 * calendar shows it: an iCloud or Google calendar is one calendar on every
 * device, and the other device's export takes the same event (findDuplicateEvent),
 * so this iPhone's deletion can clear it everywhere. Those added on other devices
 * "may remain", not "will stay".
 */
import { translations } from '../translations';

const { ru, en, es, de } = translations;
const NBSP = ' ';

describe('The confirmation: what this iPhone added goes, what others added may remain (T-413)', () => {
  it('says it in every language, word for word', () => {
    expect(ru.profile.deleteAccountCalendar).toBe('Rehearsly также уберёт из календаря репетиции, которые добавил на этом iPhone. Добавленные на других устройствах могут остаться.');
    expect(en.profile.deleteAccountCalendar).toBe('Rehearsly will also remove from your calendar any rehearsals it added on this iPhone. Those it added on your other devices may remain.');
    expect(es.profile.deleteAccountCalendar).toBe('Rehearsly quitará del calendario los ensayos que haya añadido desde este iPhone; los añadidos desde otros dispositivos pueden seguir ahí.');
    expect(de.profile.deleteAccountCalendar).toBe('Proben, die Rehearsly auf diesem iPhone in den Kalender eingetragen hat, werden daraus entfernt. Was die App auf deinen anderen Geräten eingetragen hat, bleibt möglicherweise im Kalender.');
  });
});

describe('After the deletion: the rehearsals that stayed in this iPhone’s calendar (T-413)', () => {
  const ruLeft = (count: number, noun: string) =>
    `Из календаря этого iPhone не удалось убрать ${count}${NBSP}${noun}. Их можно найти в приложении «Календарь» по названию проекта и удалить вручную.`;

  it('Russian agrees with the number, as the projects line beside it', () => {
    const said = ru.profile.deleteAccountCalendarLeft;
    expect(said(1)).toBe('Из календаря этого iPhone не удалось убрать одну репетицию. Её можно найти в приложении «Календарь» по названию проекта и удалить вручную.');
    // 21 events, so «Их», not «Её».
    expect(said(21)).toBe(ruLeft(21, 'репетицию'));
    expect(said(2)).toBe(ruLeft(2, 'репетиции'));
    expect(said(22)).toBe(ruLeft(22, 'репетиции'));
    expect(said(5)).toBe(ruLeft(5, 'репетиций'));
    expect(said(11)).toBe(ruLeft(11, 'репетиций'));
    expect(said(25)).toBe(ruLeft(25, 'репетиций'));
    expect(said(111)).toBe(ruLeft(111, 'репетиций'));
    // No more «репетиций: 1».
    expect(said(1)).not.toMatch(/репетиций:/);
  });

  it('English, Spanish and German: one and many', () => {
    expect(en.profile.deleteAccountCalendarLeft(1)).toBe('1 rehearsal could not be removed from your calendar on this iPhone. You can delete it yourself in the Calendar app — its title starts with the project name.');
    expect(en.profile.deleteAccountCalendarLeft(3)).toBe('3 rehearsals could not be removed from your calendar on this iPhone. You can delete them yourself in the Calendar app — their titles start with the project name.');
    expect(es.profile.deleteAccountCalendarLeft(1)).toBe('No se pudo quitar 1 ensayo del calendario de este iPhone. Puedes borrarlo tú en la app Calendario: su título empieza por el nombre del proyecto.');
    expect(es.profile.deleteAccountCalendarLeft(3)).toBe('No se pudieron quitar 3 ensayos del calendario de este iPhone. Puedes borrarlos tú en la app Calendario: el título de cada uno empieza por el nombre de su proyecto.');
    expect(de.profile.deleteAccountCalendarLeft(1)).toBe('1 Probe konnte nicht aus dem Kalender dieses iPhones entfernt werden. Du kannst sie in der Kalender-App selbst löschen – der Titel beginnt mit dem Projektnamen.');
    expect(de.profile.deleteAccountCalendarLeft(3)).toBe('3 Proben konnten nicht aus dem Kalender dieses iPhones entfernt werden. Du kannst sie in der Kalender-App selbst löschen – der Titel beginnt jeweils mit dem Projektnamen.');
  });

  it('says when it could not find out, in every language', () => {
    expect(ru.profile.deleteAccountCalendarUnknown).toBe('Не удалось проверить, остались ли репетиции в календаре этого iPhone. Если остались, их можно найти в приложении «Календарь» по названию проекта и удалить вручную.');
    expect(en.profile.deleteAccountCalendarUnknown).toBe('Rehearsly could not check whether any rehearsals it added on this iPhone are still in your calendar. If so, you can delete them yourself in the Calendar app — their titles start with the project name.');
    expect(es.profile.deleteAccountCalendarUnknown).toBe('No se pudo comprobar si quedan ensayos de la app en el calendario de este iPhone. Si quedan, puedes borrarlos tú en la app Calendario: el título de cada uno empieza por el nombre de su proyecto.');
    expect(de.profile.deleteAccountCalendarUnknown).toBe('Es ließ sich nicht prüfen, ob im Kalender dieses iPhones noch von Rehearsly eingetragene Proben stehen. Falls ja, kannst du sie in der Kalender-App selbst löschen – der Titel beginnt jeweils mit dem Projektnamen.');
  });

  it('English titles the alert in Title Case, as its other alerts', () => {
    expect(en.profile.deleteAccountSuccess).toBe('Account Deleted');
  });
});
