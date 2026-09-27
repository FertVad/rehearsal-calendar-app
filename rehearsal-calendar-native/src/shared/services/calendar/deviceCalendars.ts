/**
 * Every calendar on this device, by id: the scope both halves of the sync work
 * in (R7, CLAUDE.md 12).
 *
 * A calendar id is the device's own — the same iCloud calendar has another id
 * on the next phone — so an imported row or an export mapping recorded under
 * one belongs to the device that has it. The import names these to the server
 * so it reconciles only inside them (EI01); the export keeps to the mappings
 * recorded under them, so one phone neither takes another's event ids for its
 * own nor deletes another's mappings (ES02).
 *
 * Throws when the calendars cannot be listed: that is not the same as none.
 */
import * as Calendar from 'expo-calendar';

export async function listDeviceCalendarIds(): Promise<string[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.map((calendar) => calendar.id);
}
