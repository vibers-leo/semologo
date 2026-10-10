CREATE TABLE IF NOT EXISTS semologo.traffic_sessions (
 session_id uuid PRIMARY KEY, first_seen timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(),
 attribution jsonb NOT NULL DEFAULT '{}', device text NOT NULL, browser text NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_sessions_last_seen ON semologo.traffic_sessions(last_seen DESC);
CREATE TABLE IF NOT EXISTS semologo.traffic_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, session_id uuid NOT NULL REFERENCES semologo.traffic_sessions ON DELETE CASCADE,
 event text NOT NULL CHECK(event IN ('page_view','search_submitted','search_no_result','brand_opened','logo_downloaded','bookmark_help_opened','bookmark_link_copied')),
 path text NOT NULL, params jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS traffic_events_session ON semologo.traffic_events(session_id,created_at DESC);
CREATE INDEX IF NOT EXISTS traffic_events_date ON semologo.traffic_events(created_at DESC);
