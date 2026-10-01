CREATE TABLE IF NOT EXISTS logo_posts (
  id text PRIMARY KEY,
  name_ko text NOT NULL,
  name_en text,
  category text NOT NULL DEFAULT '기타',
  origin text CHECK (origin IN ('KR','GLOBAL')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  logo_svg text,
  logo_png text,
  website text,
  official_source_page text,
  asset_origin text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX IF NOT EXISTS logo_posts_status_updated_idx ON logo_posts(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS logo_posts_name_ko_idx ON logo_posts USING gin (to_tsvector('simple', name_ko));
CREATE INDEX IF NOT EXISTS logo_posts_category_idx ON logo_posts(category);
