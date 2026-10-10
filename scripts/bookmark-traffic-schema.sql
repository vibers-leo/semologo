BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE semologo.traffic_events DROP CONSTRAINT IF EXISTS traffic_events_event_check;
ALTER TABLE semologo.traffic_events ADD CONSTRAINT traffic_events_event_check CHECK(event IN ('page_view','search_submitted','search_no_result','brand_opened','logo_downloaded','bookmark_help_opened','bookmark_link_copied'));
COMMIT;
