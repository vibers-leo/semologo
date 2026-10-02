-- NCP Vibers PostgreSQL: semologo owns an isolated schema so the legacy
-- application tables remain untouched during the CMS migration.
CREATE SCHEMA IF NOT EXISTS semologo;

CREATE TABLE IF NOT EXISTS semologo.logo_posts (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- JSON staging keeps the 182k-record legacy export lossless. Validate counts
-- and payload IDs before promoting into logo_posts.
CREATE TABLE IF NOT EXISTS semologo.logo_posts_staging (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logo_posts_status_updated_idx ON semologo.logo_posts(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS logo_posts_payload_idx ON semologo.logo_posts USING gin (payload);

-- Redis replacement for popularity counters. One row per brand/event type keeps
-- writes small and makes ranking a single indexed aggregate query.
CREATE TABLE IF NOT EXISTS semologo.logo_hits (
  brand_id text NOT NULL,
  hit_type text NOT NULL,
  hit_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, hit_type)
);
CREATE INDEX IF NOT EXISTS logo_hits_updated_idx ON semologo.logo_hits(updated_at DESC);
