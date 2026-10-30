// The first whole hour after now, and the one after it, as HH:00 on the
// machine's clock - the zone every profile but Chebutykin's is in (seed.mjs) -
// into ${output.NEXT_HOUR} and ${output.HOUR_AFTER}. The second is for a
// form opened after the hour turned (flow 26, T-012).
// Run by Maestro (runScript), which provides output.
const now = new Date();
const hour = (n) => String((now.getHours() + n) % 24).padStart(2, '0') + ':00';
output.NEXT_HOUR = hour(1);
output.HOUR_AFTER = hour(2);
