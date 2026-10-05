BEGIN;
CREATE TABLE IF NOT EXISTS semologo.personal_logos (
 id text PRIMARY KEY,
 owner_id text NOT NULL,
 name text NOT NULL,
 png bytea NOT NULL CHECK (octet_length(png) <= 256000),
 sha256 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,sha256)
);
CREATE INDEX IF NOT EXISTS personal_logos_owner_idx ON semologo.personal_logos(owner_id);
COMMIT;
