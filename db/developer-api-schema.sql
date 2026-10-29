-- Preparation only. Apply through a reviewed migration; no paid plan is granted.
BEGIN;
CREATE TABLE IF NOT EXISTS semologo.api_keys (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL,
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
 key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[a-f0-9]{64}$'),
 key_prefix text NOT NULL,
 scopes text[] NOT NULL CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['walls:read','walls:write','collection:request']::text[]),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 last_used_at timestamptz,
 CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS api_keys_owner_idx ON semologo.api_keys(owner_id,created_at DESC);

-- An entitlement is an explicit, bounded service allowance, not a payment.
-- Overlapping active periods fail closed in the application, rather than adding limits.
CREATE TABLE IF NOT EXISTS semologo.api_entitlements (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL,
 metric text NOT NULL CHECK (metric IN ('wall_plan','wall_create','wall_read','wall_preview','collection_request','collection_resume')),
 plan_reference text NOT NULL,
 period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL,
 hard_limit bigint NOT NULL CHECK (hard_limit BETWEEN 0 AND 100000000),
 state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','suspended','ended')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (period_end > period_start),
 UNIQUE(owner_id,metric,period_start)
);
CREATE INDEX IF NOT EXISTS api_entitlements_lookup_idx ON semologo.api_entitlements(owner_id,metric,period_start,period_end) WHERE state='active';
CREATE TABLE IF NOT EXISTS semologo.api_usage_balances (
 entitlement_id uuid PRIMARY KEY REFERENCES semologo.api_entitlements(id),
 used_units bigint NOT NULL DEFAULT 0 CHECK (used_units >= 0),
 reserved_units bigint NOT NULL DEFAULT 0 CHECK (reserved_units >= 0)
);
CREATE TABLE IF NOT EXISTS semologo.api_usage_events (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL,
 api_key_id uuid NOT NULL REFERENCES semologo.api_keys(id),
 entitlement_id uuid NOT NULL REFERENCES semologo.api_entitlements(id),
 metric text NOT NULL,
 request_key text NOT NULL CHECK (char_length(request_key) BETWEEN 16 AND 128),
 request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
 reserved_units smallint NOT NULL CHECK (reserved_units=1),
 charged_units smallint NOT NULL DEFAULT 0 CHECK (charged_units IN (0,1)),
 state text NOT NULL CHECK (state IN ('reserved','succeeded','voided','indeterminate')),
 result_json jsonb,
 read_replay_count smallint NOT NULL DEFAULT 0 CHECK (read_replay_count BETWEEN 0 AND 1),
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 UNIQUE(owner_id,request_key)
);
CREATE INDEX IF NOT EXISTS api_usage_events_owner_idx ON semologo.api_usage_events(owner_id,created_at DESC);
COMMENT ON TABLE semologo.api_usage_events IS 'Operational usage units only. No currency, card data, invoice or automatic overage charge.';
COMMIT;
