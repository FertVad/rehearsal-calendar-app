// expo-calendar in an e2e bundle: the real module, and when the launch asks
// for it a calendar that will not take one event or will not let one go — as
// iOS refuses a write to a calendar it has made read-only, or a delete of an
// event a subscribed calendar owns (T-256). The simulator's calendar takes
// everything, so without this no flow could show what the sync says when a
// write or a removal fails: those are the only failures of either (calendar
// export.ts counts a step failed only when EventKit threw).
//
// A flow launches the app with
//   arguments: { rehearslyCalendarRefusesWrite: "<title>",
//                rehearslyCalendarRefusesDelete: "<title>" }
// and the event whose title contains <title> is refused that way, every time;
// every other event goes to the real calendar. iOS puts launch arguments among
// the user defaults, which React Native's Settings reads (as pushDevice.js).
// Without them this is the real module.
//
// Only an e2e bundle has this: metro.config.js hands it in for expo-calendar
// when REHEARSLY_E2E is set.
const Calendar = require('expo-calendar');
const { Settings } = require('react-native');

const refusesWrite = Settings.get('rehearslyCalendarRefusesWrite');
const refusesDelete = Settings.get('rehearslyCalendarRefusesDelete');

const named = (fragment, title) => typeof fragment === 'string' && fragment !== ''
  && typeof title === 'string' && title.includes(fragment);

const refused = (what) => Promise.reject(new Error(`${what}: the calendar is read-only (e2e)`));

module.exports = refusesWrite == null && refusesDelete == null
  ? Calendar
  : {
      ...Calendar,
      createEventAsync: (calendarId, details, ...rest) => (named(refusesWrite, details?.title)
        ? refused(`Writing "${details.title}"`)
        : Calendar.createEventAsync(calendarId, details, ...rest)),
      deleteEventAsync: async (eventId, ...rest) => {
        const event = await Calendar.getEventAsync(eventId).catch(() => null);
        if (named(refusesDelete, event?.title)) return refused(`Removing "${event.title}"`);
        return Calendar.deleteEventAsync(eventId, ...rest);
      },
    };
