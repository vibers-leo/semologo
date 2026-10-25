CREATE TABLE IF NOT EXISTS semologo.stories (
 slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
 status text NOT NULL CHECK (status IN ('draft','published','archived')),
 payload jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS semologo.story_revisions (
 slug text NOT NULL REFERENCES semologo.stories(slug), revision integer NOT NULL,
 status text NOT NULL, payload jsonb NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(slug,revision)
);
CREATE INDEX IF NOT EXISTS stories_public ON semologo.stories(status,updated_at DESC);
