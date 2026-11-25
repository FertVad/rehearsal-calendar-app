/**
 * The second reading by native speakers, 15.11.2026 (T-261): every string it
 * changed, word for word, in every language it changed it in; and a name the
 * person typed in quotes never doubles them, on any screen that quotes one.
 * The pushes are the server's (rehearsalNoticeText.integration.test.js, T-261).
 */
import * as fs from 'fs';
import * as path from 'path';
import { translations } from '../translations';
import { quoteName } from '../../../shared/quoteName.cjs';

const { ru, en, es, de } = translations;

describe('T-261: the strings the second reading changed', () => {
  it('the line under the form\'s participants: a label, the name, the time in brackets', () => {
    expect(en.rehearsals.busyAt('Maya Lopez', '6:00 PM–9:00 PM')).toBe('Busy: Maya Lopez (6:00 PM–9:00 PM)');
    expect(de.rehearsals.busyAt('Wang Wasser', '10:00–14:00')).toBe('Beschäftigt: Wang Wasser (10:00–14:00)');
    // ru and es keep theirs.
    expect(ru.rehearsals.busyAt('Анна Иванова', '10:00–14:00')).toBe('Анна Иванова: занято 10:00–14:00');
    expect(es.rehearsals.busyAt('Lucía Martín', '10:00–14:00')).toBe('Lucía Martín: no disponible 10:00–14:00');
  });

  it('a full stop after the last sentence', () => {
    expect(es.auth.noConnection).toBe('No hay conexión con el servidor. Comprueba que tienes internet e inténtalo de nuevo.');
    expect(es.auth.requestFailed).toBe('Algo salió mal. Inténtalo de nuevo.');
    expect(de.auth.noConnection).toBe('Keine Verbindung zum Server. Prüfe deine Internetverbindung und versuche es erneut.');
    expect(de.auth.requestFailed).toBe('Etwas ist schiefgelaufen. Versuche es erneut.');
    // Reworded with the weekends in it (T-408), still with its full stop.
    expect(de.onboarding.skipMessage).toBe('Du kannst jederzeit den Wochenbeginn ändern, die Kalendersynchronisation einrichten und festlegen, ob deine Wochenenden als belegt gelten – alles unter Profil → Einstellungen.');
  });

  it('the question before deleting a rehearsal: its date in brackets', () => {
    expect(ru.rehearsals.deleteTitle('Сцена дуэли', 'сб, 22 авг., 19:00')).toBe('Удалить «Сцена дуэли» (сб, 22 авг., 19:00)?');
    expect(ru.rehearsals.deleteTitle(null, 'сб, 22 авг., 19:00')).toBe('Удалить репетицию (сб, 22 авг., 19:00)?');
    expect(en.rehearsals.deleteTitle('Fight scene', 'Sat, Aug 22, 7:00 PM')).toBe('Delete “Fight scene” (Sat, Aug 22, 7:00 PM)?');
    expect(en.rehearsals.deleteTitle(null, 'Sat, Aug 22, 7:00 PM')).toBe('Delete the rehearsal (Sat, Aug 22, 7:00 PM)?');
    expect(es.rehearsals.deleteTitle('Escena del duelo', 'sáb, 22 ago, 19:00')).toBe('¿Eliminar «Escena del duelo» (sáb, 22 ago, 19:00)?');
    expect(es.rehearsals.deleteTitle(null, 'sáb, 22 ago, 19:00')).toBe('¿Eliminar el ensayo (sáb, 22 ago, 19:00)?');
    expect(de.rehearsals.deleteTitle('Szene am Fenster', 'Sa., 22. Aug., 19:00')).toBe('„Szene am Fenster“ (Sa., 22. Aug., 19:00) löschen?');
  });

  it('the one button after Skip in the onboarding is OK', () => {
    expect([ru.common.ok, en.common.ok, es.common.ok, de.common.ok]).toEqual(['ОК', 'OK', 'OK', 'OK']);
  });

  it('yesterday is yesterday in English and Spanish too', () => {
    expect(en.calendarSync.daysAgo(1)).toBe('yesterday');
    expect(en.calendarSync.daysAgo(2)).toBe('2d ago');
    expect(en.calendarSync.syncedAgo(en.calendarSync.daysAgo(1))).toBe('Synced yesterday');
    expect(es.calendarSync.daysAgo(1)).toBe('ayer');
    expect(es.calendarSync.daysAgo(21)).toBe('hace 21 d');
  });

  it('"What is where": by invitation, not the code twice', () => {
    expect(en.onboarding.whatWhere.projectWhere('Create Project', 'Projects', 'Join with a Code'))
      .toBe('“+” → “Create Project”. Invited? “Projects” → “Join with a Code”');
    expect(es.onboarding.whatWhere.projectWhere('Crear proyecto', 'Proyectos', 'Unirse con un código'))
      .toBe('«+» → «Crear proyecto». Con una invitación: «Proyectos» → «Unirse con un código»');
    expect(de.onboarding.whatWhere.projectWhere('Projekt erstellen', 'Projekte', 'Mit einem Code beitreten'))
      .toBe('„+“ → „Projekt erstellen“. Per Einladung: „Projekte“ → „Mit einem Code beitreten“');
  });

  it('Spanish: one device, one word for a notice, no sentence opening on a number', () => {
    expect(es.auth.timezoneInvalid).toBe('No se reconoció la zona horaria del teléfono. Revísala en la configuración de fecha y hora.');
    expect(es.rehearsals.deleteNotifiedUnknown)
      .toBe('No se pudo saber quién recibirá la notificación de la cancelación. Comprueba la conexión e inténtalo de nuevo.');
    expect(es.calendarSync.removeAllPartial(5, 2)).toBe('Eliminados: 5. No se pudieron eliminar 2 eventos, que siguen en el calendario.');
    expect(es.calendarSync.removeAllPartial(21, 21)).toBe('Eliminados: 21. No se pudieron eliminar 21 eventos, que siguen en el calendario.');
    expect(es.calendarSync.removeAllPartial(5, 1)).toBe('Eliminados: 5. Un evento no se pudo eliminar y sigue en el calendario.');
  });

  it('deleting a project deletes no people', () => {
    expect(es.projects.deleteProjectWarning)
      .toBe('Todos los ensayos y datos del proyecto se eliminarán de forma permanente, y sus miembros perderán el acceso.');
    expect(de.projects.deleteProjectWarning)
      .toBe('Alle Proben, die Mitgliederliste und alle anderen Projektdaten werden unwiderruflich gelöscht.');
  });

  // Written again in T-412 from the owner's text; "einteilen" is not in it.
  it('German: the notifications step as T-412 wrote it', () => {
    expect(de.onboarding.notifications.description).toBe('Neue Probe, Absage oder Verschiebung\u00a0–\ndu erfährst es sofort.');
  });

  it('Spanish: the project in the invitation\'s title is in quotes', () => {
    expect(es.projects.shareInviteTitle('Hamlet')).toBe('Invitación al proyecto «Hamlet»');
    expect(es.projects.shareInviteMessage('Bodas de sangre 2026')).toBe('Únete al proyecto «Bodas de sangre 2026» en la app Rehearsly:');
  });

  it('Russian iOS prompt: your reminders', () => {
    const texts = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../locales/ru.json'), 'utf8')).ios;
    expect(texts.NSRemindersUsageDescription).toBe('Rehearsly не использует ваши напоминания.');
    expect(texts.NSRemindersFullAccessUsageDescription).toBe('Rehearsly не использует ваши напоминания.');
  });
});

describe('T-261: a name typed in quotes is not quoted twice', () => {
  it('the quotes around the whole name go, in every way they are typed', () => {
    expect(quoteName('«Вишнёвый сад»', 'ru')).toBe('«Вишнёвый сад»');
    expect(quoteName('"Вишнёвый сад"', 'ru')).toBe('«Вишнёвый сад»');
    expect(quoteName('“Hamlet”', 'es')).toBe('«Hamlet»');
    expect(quoteName('„Die Räuber“', 'en')).toBe('“Die Räuber”');
    expect(quoteName('‘Hamlet’', 'de')).toBe('„Hamlet“');
    expect(quoteName('‚Hamlet‘', 'ru')).toBe('«Hamlet»');
    expect(quoteName('  «Hamlet»  ', 'es')).toBe('«Hamlet»');
  });

  it('quotes inside it become the language\'s second level', () => {
    expect(quoteName('Прогон «Чайки»', 'ru')).toBe('«Прогон „Чайки“»');
    expect(quoteName('«Прогон «Чайки»»', 'ru')).toBe('«Прогон „Чайки“»');
    expect(quoteName('Durchlauf „Die Möwe“', 'de')).toBe('„Durchlauf ‚Die Möwe‘“');
    expect(quoteName('Pasada de "La gaviota"', 'es')).toBe('«Pasada de “La gaviota”»');
    expect(quoteName('Run of “The Seagull”', 'en')).toBe('“Run of ‘The Seagull’”');
  });

  // Review of T-261: a mark right after a closing one was read as an opening
  // one — „Durchlauf ‚Die Möwe‘“ kept its outer pair and became
  // „‚Durchlauf ‚Die Möwe‘‚“. A name already quoted right stays as it is.
  it('a name already nested right keeps its quotes, in every language', () => {
    expect(quoteName('„Durchlauf ‚Die Möwe‘“', 'de')).toBe('„Durchlauf ‚Die Möwe‘“');
    expect(quoteName('«Прогон „Чайки“»', 'ru')).toBe('«Прогон „Чайки“»');
    expect(quoteName('«Pasada de “La gaviota”»', 'es')).toBe('«Pasada de “La gaviota”»');
    expect(quoteName('“Run of ‘The Seagull’”', 'en')).toBe('“Run of ‘The Seagull’”');
    expect(quoteName('„Durchlauf ‚Die Möwe‘“', 'en')).toBe('“Durchlauf ‘Die Möwe’”');
    expect(quoteName('„Durchlauf ‚Die Möwe‘“', 'ru')).toBe('«Durchlauf „Die Möwe“»');
    expect(quoteName('„Durchlauf ‚Die Möwe‘“', 'es')).toBe('«Durchlauf “Die Möwe”»');
    // Typed with one level twice, the German way: the second “ closes too.
    expect(quoteName('„Probe „Die Möwe““', 'de')).toBe('„Probe ‚Die Möwe‘“');
    expect(quoteName('Probe „Die Möwe“ – Teil 2', 'de')).toBe('„Probe ‚Die Möwe‘ – Teil 2“');
    // On the screens: the question before deleting, the invitation.
    expect(de.rehearsals.deleteTitle('„Durchlauf ‚Die Möwe‘“', 'Sa., 22. Aug., 19:00')).toBe('„Durchlauf ‚Die Möwe‘“ (Sa., 22. Aug., 19:00) löschen?');
    expect(en.rehearsals.deleteTitle('„Ghost watch ‚Act I‘“', 'Sat, Aug 22, 7:00 PM')).toBe('Delete “Ghost watch ‘Act I’” (Sat, Aug 22, 7:00 PM)?');
    expect(de.projects.deleteProjectMessage('„Durchlauf ‚Die Möwe‘“')).toBe('Möchtest du das Projekt „Durchlauf ‚Die Möwe‘“ wirklich löschen?');
  });

  it('two names in quotes are not one, and an apostrophe is not a quote', () => {
    expect(quoteName('«Чайка» и «Гамлет»', 'ru')).toBe('«„Чайка“ и „Гамлет“»');
    expect(quoteName('Rock’n’roll', 'ru')).toBe('«Rock’n’roll»');
    expect(quoteName('Actors’ studio', 'de')).toBe('„Actors’ studio“');
    expect(quoteName('Hamlet', 'de')).toBe('„Hamlet“');
  });

  // Review of T-261, round 2: an apostrophe inside ‚…‘ was read as the mark
  // closing it — ‚Actors’ Studio‘ became „‚Actors‘ Studio‘“. A single closing
  // mark closes only its own pair: ‚ is closed by ‘, ‘ by ’; else it is an
  // apostrophe.
  it('an apostrophe inside German single quotes stays an apostrophe', () => {
    expect(quoteName('‚Actors’ Studio‘', 'de')).toBe('„Actors’ Studio“');
    expect(quoteName('‚Actors’ Studio‘', 'en')).toBe('“Actors’ Studio”');
    expect(quoteName('‚Actors’ Studio‘', 'ru')).toBe('«Actors’ Studio»');
    expect(quoteName('‚Actors’ Studio‘', 'es')).toBe('«Actors’ Studio»');
    expect(quoteName('Probe ‚Actors’ Studio‘', 'de')).toBe('„Probe ‚Actors’ Studio‘“');
    expect(quoteName('Probe ‚Actors’ Studio‘', 'en')).toBe('“Probe ‘Actors’ Studio’”');
    expect(quoteName('Probe ‚Actors’ Studio‘', 'ru')).toBe('«Probe „Actors’ Studio“»');
    expect(quoteName('Probe ‚Actors’ Studio‘', 'es')).toBe('«Probe “Actors’ Studio”»');
    expect(quoteName('„Ghost watch ‚Actors’ Act‘“', 'en')).toBe('“Ghost watch ‘Actors’ Act’”');
    // What was right stays right.
    expect(quoteName('Rock’n’Roll', 'de')).toBe('„Rock’n’Roll“');
    expect(quoteName('‘Hamlet’ and ‘Lear’', 'en')).toBe('“‘Hamlet’ and ‘Lear’”');
    expect(quoteName('Прогон ‚Чайки‘', 'ru')).toBe('«Прогон „Чайки“»');
    // On the screen: the question before deleting a rehearsal.
    expect(de.rehearsals.deleteTitle('‚Actors’ Studio‘', 'Sa., 22. Aug., 19:00')).toBe('„Actors’ Studio“ (Sa., 22. Aug., 19:00) löschen?');
    expect(en.rehearsals.deleteTitle('„Ghost watch ‚Actors’ Act‘“', 'Sat, Aug 22, 7:00 PM')).toBe('Delete “Ghost watch ‘Actors’ Act’” (Sat, Aug 22, 7:00 PM)?');
  });

  it('on every screen that quotes a name, in every language', () => {
    // Projects: the invitation and the question before deleting.
    expect(ru.projects.deleteProjectMessage('«Вишнёвый сад»')).toBe('Вы уверены, что хотите удалить проект «Вишнёвый сад»?');
    expect(ru.projects.shareInviteTitle('"Вишнёвый сад"')).toBe('Приглашение в проект «Вишнёвый сад»');
    expect(ru.projects.shareInviteMessage('Прогон «Чайки»')).toBe('Присоединяйтесь к проекту «Прогон „Чайки“» в приложении Rehearsly:');
    expect(en.projects.deleteProjectMessage('“Hamlet”')).toBe('Are you sure you want to delete the project “Hamlet”?');
    expect(en.projects.shareInviteMessage('"Hamlet"')).toBe('Join the project “Hamlet” in the Rehearsly app:');
    expect(es.projects.shareInviteTitle('«Hamlet»')).toBe('Invitación al proyecto «Hamlet»');
    expect(es.projects.deleteProjectMessage('Bodas de "sangre"')).toBe('¿Seguro que quieres eliminar el proyecto «Bodas de “sangre”»?');
    expect(es.projects.shareInviteMessage('“Hamlet”')).toBe('Únete al proyecto «Hamlet» en la app Rehearsly:');
    expect(de.projects.shareInviteTitle('„Die Räuber“')).toBe('Einladung zum Projekt „Die Räuber“');
    expect(de.projects.shareInviteMessage('«Die Räuber»')).toBe('Tritt dem Projekt „Die Räuber“ in der Rehearsly-App bei:');
    expect(de.projects.deleteProjectMessage('Die „Räuber“')).toBe('Möchtest du das Projekt „Die ‚Räuber‘“ wirklich löschen?');
    // Rehearsals: the question before deleting.
    expect(ru.rehearsals.deleteTitle('Прогон «Чайки»', 'сб, 22 авг., 19:00')).toBe('Удалить «Прогон „Чайки“» (сб, 22 авг., 19:00)?');
    expect(en.rehearsals.deleteTitle('"Fight scene"', 'Sat, Aug 22, 7:00 PM')).toBe('Delete “Fight scene” (Sat, Aug 22, 7:00 PM)?');
    expect(es.rehearsals.deleteTitle('«Escena del duelo»', 'sáb, 22 ago, 19:00')).toBe('¿Eliminar «Escena del duelo» (sáb, 22 ago, 19:00)?');
    expect(de.rehearsals.deleteTitle('„Szene am Fenster“', 'Sa., 22. Aug., 19:00')).toBe('„Szene am Fenster“ (Sa., 22. Aug., 19:00) löschen?');
  });
});
