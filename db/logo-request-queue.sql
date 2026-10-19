CREATE TABLE IF NOT EXISTS semologo.logo_request_queue (
  id uuid PRIMARY KEY,
  request_key text NOT NULL UNIQUE,
  message text NOT NULL,
  requested_name text NOT NULL,
  official_url text,
  source_checked_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','discovering','review_required','published','unavailable')),
  priority integer NOT NULL DEFAULT 100,
  request_count integer NOT NULL DEFAULT 1,
  requester_hash text NOT NULL,
  fleet_job_id text,
  published_brand_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE semologo.logo_request_queue ADD COLUMN IF NOT EXISTS source_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS logo_request_queue_priority_idx
  ON semologo.logo_request_queue(status, priority DESC, request_count DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS logo_request_queue_requester_idx
  ON semologo.logo_request_queue(requester_hash, created_at DESC);
