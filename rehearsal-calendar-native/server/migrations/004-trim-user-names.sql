-- Cut the stray spaces out of names already stored.
--
-- A phone keyboard's autocomplete leaves a trailing space, so accounts were
-- created with first_name 'Ginger ' and last_name 'Rode '. Joined for display
-- that reads 'Ginger  Rode ' — two spaces and one at the end — which is how it
-- reached a push notification.
--
-- Names are trimmed on the way in now (registration and PUT /me); this is for
-- the rows written before that. Safe to run more than once.

UPDATE native_users
SET first_name = TRIM(first_name)
WHERE first_name IS NOT NULL AND first_name <> TRIM(first_name);

UPDATE native_users
SET last_name = TRIM(last_name)
WHERE last_name IS NOT NULL AND last_name <> TRIM(last_name);

-- A name that was nothing but spaces is not a surname.
UPDATE native_users
SET last_name = NULL
WHERE last_name = '';

UPDATE native_projects
SET name = TRIM(name)
WHERE name IS NOT NULL AND name <> TRIM(name);
