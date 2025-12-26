/**
 * Adapt calendar sync tables for expo-calendar approach
 *
 * Current schema is designed for OAuth-based sync (Google Calendar API)
 * But we're using expo-calendar which works with device calendar directly via system permissions
 *
 * Changes:
 * 1. Make OAuth fields nullable (not needed for expo-calendar)
 * 2. Add device_calendar_id for expo-calendar ID
 * 3. Simplify for device-based sync
 */

-- Make OAuth fields nullable (not needed for expo-calendar approach)
ALTER TABLE native_calendar_connections
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN calendar_id DROP NOT NULL;

-- Add device_calendar_id column for expo-calendar
ALTER TABLE native_calendar_connections
  ADD COLUMN IF NOT EXISTS device_calendar_id VARCHAR,
  ADD COLUMN IF NOT EXISTS device_calendar_name VARCHAR;

-- Add comment to clarify usage
COMMENT ON TABLE native_calendar_connections IS
  'Calendar connections - supports both OAuth (Google) and device-based (Apple via expo-calendar) sync';

COMMENT ON COLUMN native_calendar_connections.device_calendar_id IS
  'Calendar ID from expo-calendar (for Apple/Google device calendars)';

COMMENT ON COLUMN native_calendar_connections.access_token IS
  'OAuth access token (only for Google Calendar API sync, nullable for device-based sync)';

COMMENT ON COLUMN native_calendar_connections.calendar_id IS
  'External calendar ID (only for OAuth sync, nullable for device-based sync)';

-- Add index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id
  ON native_calendar_connections(user_id);

-- Add index on device_calendar_id
CREATE INDEX IF NOT EXISTS idx_calendar_connections_device_calendar_id
  ON native_calendar_connections(device_calendar_id);

-- Add check constraint to ensure at least one calendar ID is present
ALTER TABLE native_calendar_connections
  ADD CONSTRAINT check_calendar_id
  CHECK (
    calendar_id IS NOT NULL OR device_calendar_id IS NOT NULL
  );

-- Add indexes on event_mappings for fast lookups
CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_connection_id
  ON native_calendar_event_mappings(connection_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_internal_event
  ON native_calendar_event_mappings(event_type, internal_event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_mappings_external_event
  ON native_calendar_event_mappings(external_event_id);

-- Add comment
COMMENT ON TABLE native_calendar_event_mappings IS
  'Tracks mapping between internal events (rehearsals) and external calendar events';

COMMENT ON COLUMN native_calendar_event_mappings.event_type IS
  'Type of internal event: "rehearsal" or "availability"';

COMMENT ON COLUMN native_calendar_event_mappings.internal_event_id IS
  'ID of the rehearsal or availability slot in our database';

COMMENT ON COLUMN native_calendar_event_mappings.external_event_id IS
  'ID of the event in the external calendar (from expo-calendar or Google Calendar API)';

COMMENT ON COLUMN native_calendar_event_mappings.external_event_etag IS
  'ETag for change detection (Google Calendar API only, nullable for expo-calendar)';

COMMENT ON COLUMN native_calendar_event_mappings.last_sync_direction IS
  'Direction of last sync: "export" (app→calendar) or "import" (calendar→app)';
