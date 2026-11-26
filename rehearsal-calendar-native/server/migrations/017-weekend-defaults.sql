-- 017: weekends busy by default (T-406).
--
-- Each person's weekends — the days of the country of their profile's zone,
-- by CLDR (shared/contracts/weekends.json) — are written into their calendar
-- as real "busy all day" rows of source 'weekend', a year ahead, on the days
-- they have not marked themselves (services/availability/weekendDefaults.js).
-- Three columns of the person's row say how:
--
-- weekends_busy: the profile's switch. On for everyone, those already
-- registered included; off takes the rows from today on away.
-- weekends_through: the last date the rows have been laid out to. The next
-- ones are added after it, so a weekend day the person cleared stays clear.
-- weekends_days: the ISO weekdays (1 Monday ... 7 Sunday) they were laid out
-- for, '5,6' for Israel; a change of zone to another country moves them.
--
-- Columns, no data: nothing is written here. The server lays the rows out when
-- someone's availability is read — their own screen or a planner — and works
-- without this step, writing none.
ALTER TABLE native_users ADD COLUMN weekends_busy BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE native_users ADD COLUMN weekends_through DATE;
ALTER TABLE native_users ADD COLUMN weekends_days VARCHAR(20);
