-- Draft migration: review/apply separately; this file does not change production.
BEGIN;
CREATE SCHEMA IF NOT EXISTS semologo;
CREATE TABLE IF NOT EXISTS semologo.collections (
 id text PRIMARY KEY,
 name text NOT NULL,
 scope jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS semologo.collection_snapshots (
 id text PRIMARY KEY,
 collection_id text NOT NULL REFERENCES semologo.collections(id),
 as_of date NOT NULL,
 source_url text NOT NULL,
 source_revision text,
 expected_count integer NOT NULL CHECK (expected_count >= 0),
 count_unit text NOT NULL CHECK (count_unit IN ('entity','security')),
 UNIQUE(collection_id, as_of)
);
-- Member key identifies an official roster row, even before a logo is found.
CREATE TABLE IF NOT EXISTS semologo.collection_members (
 snapshot_id text NOT NULL REFERENCES semologo.collection_snapshots(id),
 member_key text NOT NULL,
 name text NOT NULL,
 brand_id text REFERENCES semologo.logo_posts(id),
 wikidata_qid text CHECK (wikidata_qid IS NULL OR wikidata_qid ~ '^Q[1-9][0-9]*$'),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','matched','verified','rejected')),
 PRIMARY KEY(snapshot_id, member_key)
);
CREATE INDEX IF NOT EXISTS collection_members_brand_idx ON semologo.collection_members(brand_id);
CREATE TABLE IF NOT EXISTS semologo.brand_relations (
 from_brand_id text NOT NULL REFERENCES semologo.logo_posts(id),
 to_brand_id text NOT NULL REFERENCES semologo.logo_posts(id),
 relation_type text NOT NULL CHECK (relation_type IN ('subsidiary_of','administrative_part_of')),
 source_url text NOT NULL,
 verified_at timestamptz,
 PRIMARY KEY(from_brand_id,to_brand_id,relation_type),
 CHECK (from_brand_id <> to_brand_id)
);
-- Owner IDs use the existing auth identity; API must verify ownership on every operation.
CREATE TABLE IF NOT EXISTS semologo.logo_walls (
 id text PRIMARY KEY,
 owner_id text NOT NULL,
 title text NOT NULL,
 settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS logo_walls_owner_idx ON semologo.logo_walls(owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS semologo.logo_wall_items (
 wall_id text NOT NULL REFERENCES semologo.logo_walls(id) ON DELETE CASCADE,
 item_id text NOT NULL,
 brand_id text REFERENCES semologo.logo_posts(id),
 position integer NOT NULL CHECK (position >= 0),
 asset_snapshot jsonb NOT NULL,
 PRIMARY KEY(wall_id,item_id),
 UNIQUE(wall_id,position)
);
COMMIT;
