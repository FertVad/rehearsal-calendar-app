// The first whole hour after now, and the one after it, on the machine's
// clock - the zone every profile but Chebutykin's is in (seed.mjs) - into
// ${output.NEXT_HOUR} and ${output.HOUR_AFTER}. The second is for a form
// opened after the hour turned (flow 26, T-012). Written as the en_US
// simulator shows them, on the 12-hour clock (T-017), as a pattern: "4:00.PM",
// the "." for the narrow space before AM/PM.
// Run by Maestro (runScript), which provides output.
const now = new Date();
const hour = (n) => {
  const h = (now.getHours() + n) % 24;
  return `${h % 12 || 12}:00.${h < 12 ? 'AM' : 'PM'}`;
};
output.NEXT_HOUR = hour(1);
output.HOUR_AFTER = hour(2);
