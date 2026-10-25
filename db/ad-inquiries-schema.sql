CREATE TABLE IF NOT EXISTS semologo.ad_inquiries (
 id uuid PRIMARY KEY, name text NOT NULL, company text NOT NULL DEFAULT '', email text NOT NULL,
 kind text NOT NULL, message text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewing','replied','closed')),
 admin_note text NOT NULL DEFAULT '', attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
 requester_hash text NOT NULL, email_status text NOT NULL DEFAULT 'pending' CHECK(email_status IN ('pending','sending','sent','failed')),
 email_results jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '1 year'
);
CREATE INDEX IF NOT EXISTS ad_inquiries_queue ON semologo.ad_inquiries(status,created_at DESC);
CREATE INDEX IF NOT EXISTS ad_inquiries_rate ON semologo.ad_inquiries(requester_hash,created_at DESC);
