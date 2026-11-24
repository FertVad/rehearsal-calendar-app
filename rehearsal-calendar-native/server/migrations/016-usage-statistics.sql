-- 016: what the admin's usage statistics are counted from (T-294).
--
-- Nothing recorded use before: someone who opens the app every day could not
-- be told from someone who left (H03). Two tables, both kept 13 months; the
-- server deletes older rows itself, when the admin page opens and at most
-- hourly on a write. A server deployed before this step records nothing and
-- otherwise works as before.
--
-- native_usage_days: the days a person used the app, in their own zone, with
-- the app build named that day. One row per person and day — the key is what
-- makes several server instances write one. Deleted with the account.
--
-- native_invite_counts: per project and UTC day, how often its invitation page
-- was opened in a browser, opened in the app, and joined through. Counts only:
-- no IP, nothing that ties a count to a person. Deleted with the project.
CREATE TABLE native_usage_days (
  user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  app_build INTEGER CHECK (app_build >= 0),
  PRIMARY KEY (user_id, day)
);
CREATE INDEX idx_usage_days_day ON native_usage_days (day);

CREATE TABLE native_invite_counts (
  project_id INTEGER NOT NULL REFERENCES native_projects(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  page_opens INTEGER NOT NULL DEFAULT 0 CHECK (page_opens >= 0),
  app_opens INTEGER NOT NULL DEFAULT 0 CHECK (app_opens >= 0),
  joins INTEGER NOT NULL DEFAULT 0 CHECK (joins >= 0),
  PRIMARY KEY (project_id, day)
);
CREATE INDEX idx_invite_counts_day ON native_invite_counts (day);
