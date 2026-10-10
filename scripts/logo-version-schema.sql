BEGIN;
CREATE TABLE IF NOT EXISTS semologo.logo_versions (
 id text PRIMARY KEY, brand_id text NOT NULL REFERENCES semologo.logo_posts(id),
 asset_signature text NOT NULL, assets jsonb NOT NULL,
 asset_manifest jsonb, label text NOT NULL DEFAULT '수집 로고',
 version_kind text NOT NULL DEFAULT 'asset_revision' CHECK(version_kind IN ('legacy_import','asset_revision','brand_redesign')),
 introduced_year integer CHECK(introduced_year BETWEEN 1 AND 2200),
 retired_year integer CHECK(retired_year BETWEEN 1 AND 2200),
 source_url text, source_note text,
 review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','verified','rejected')),
 is_current boolean NOT NULL DEFAULT false,
 observed_at timestamptz NOT NULL DEFAULT now(), verified_at timestamptz,
 CHECK(retired_year IS NULL OR introduced_year IS NULL OR retired_year>=introduced_year),
 UNIQUE(brand_id,asset_signature)
);
ALTER TABLE semologo.logo_versions DROP CONSTRAINT IF EXISTS logo_versions_introduced_year_check;
ALTER TABLE semologo.logo_versions ADD CONSTRAINT logo_versions_introduced_year_check CHECK(introduced_year BETWEEN 1 AND 2200);
ALTER TABLE semologo.logo_versions DROP CONSTRAINT IF EXISTS logo_versions_retired_year_check;
ALTER TABLE semologo.logo_versions ADD CONSTRAINT logo_versions_retired_year_check CHECK(retired_year BETWEEN 1 AND 2200);
CREATE UNIQUE INDEX IF NOT EXISTS logo_versions_one_current ON semologo.logo_versions(brand_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS logo_versions_brand_observed ON semologo.logo_versions(brand_id,observed_at DESC);
CREATE OR REPLACE FUNCTION semologo.logo_asset_snapshot(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_strip_nulls(jsonb_build_object(
 'preview_png',coalesce(p->'preview_png',p->'metadata'->'preview_png'),
 'logo_png',coalesce(p->'logo_png',p->'metadata'->'logo_png'),
 'logo_svg',coalesce(p->'logo_svg',p->'metadata'->'logo_svg'),
 'svg_transparent',coalesce(p->'svg_transparent',p->'metadata'->'svg_transparent'),
 'has_png',coalesce(p->'has_png',p->'metadata'->'has_png'),
 'has_svg',coalesce(p->'has_svg',p->'metadata'->'has_svg'),
 'light',coalesce(p->'light',p->'metadata'->'light'),
 'dark_png',p->'dark_png','official_source_page',p->'official_source_page',
 'official_zip_url',p->'official_zip_url','source_zip',p->'source_zip'))
$$;
INSERT INTO semologo.logo_versions(id,brand_id,asset_signature,assets,label,version_kind,is_current,observed_at)
 SELECT id||'-'||md5(semologo.logo_asset_snapshot(payload)::text),id,md5(semologo.logo_asset_snapshot(payload)::text),semologo.logo_asset_snapshot(payload),'기존 수집본 · 도입 연도 미확인','legacy_import',true,now()
 FROM semologo.logo_posts p WHERE NOT EXISTS(SELECT 1 FROM semologo.logo_versions v WHERE v.brand_id=p.id)
 ON CONFLICT(brand_id,asset_signature) DO NOTHING;
CREATE OR REPLACE FUNCTION semologo.archive_logo_asset_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a jsonb; sig text; inherited_manifest jsonb;
BEGIN
 a:=semologo.logo_asset_snapshot(NEW.payload);sig:=md5(a::text);
 IF TG_OP='UPDATE' AND a=semologo.logo_asset_snapshot(OLD.payload) THEN RETURN NEW; END IF;
 -- Preserve verified files/variants before retiring the current asset version.
 SELECT asset_manifest INTO inherited_manifest FROM semologo.logo_versions
 WHERE brand_id=NEW.id AND is_current FOR UPDATE;
 UPDATE semologo.logo_versions SET is_current=false WHERE brand_id=NEW.id AND is_current;
 INSERT INTO semologo.logo_versions(id,brand_id,asset_signature,assets,asset_manifest,is_current,source_url,label)
 VALUES(NEW.id||'-'||sig,NEW.id,sig,a,inherited_manifest,true,NEW.payload->>'official_source_page','수집 로고 · 도입 연도 미확인')
 ON CONFLICT(brand_id,asset_signature) DO UPDATE SET is_current=true,
 asset_manifest=coalesce(logo_versions.asset_manifest,EXCLUDED.asset_manifest);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS archive_logo_asset_change ON semologo.logo_posts;
CREATE TRIGGER archive_logo_asset_change AFTER INSERT OR UPDATE OF payload ON semologo.logo_posts FOR EACH ROW EXECUTE FUNCTION semologo.archive_logo_asset_change();
CREATE INDEX IF NOT EXISTS logo_posts_presentation_idx ON semologo.logo_posts(id) WHERE payload ? 'presentation';
COMMIT;
