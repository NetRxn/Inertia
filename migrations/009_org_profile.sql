CREATE TABLE plugin_netrxn_inertia_e936d62b87.org_profile (
  company_id text PRIMARY KEY,
  name text NOT NULL,
  created_by text NOT NULL,
  founder_display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plugin_netrxn_inertia_e936d62b87.org_members (
  company_id text NOT NULL,
  user_id text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('founder', 'moderator', 'member')),
  status text NOT NULL CHECK (status IN ('active', 'removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_op_key text,
  PRIMARY KEY (company_id, user_id)
);

CREATE TABLE plugin_netrxn_inertia_e936d62b87.org_sources (
  company_id text NOT NULL,
  source_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('link', 'file', 'note', 'objective')),
  title text NOT NULL,
  url text,
  media_type text,
  byte_length integer,
  sha256 text,
  shared_by text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('members', 'moderators')),
  hidden jsonb,
  content bytea,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_op_key text,
  PRIMARY KEY (company_id, source_key)
);

CREATE TABLE plugin_netrxn_inertia_e936d62b87.org_source_pins (
  company_id text NOT NULL,
  source_key text NOT NULL,
  user_id text NOT NULL,
  last_op_key text,
  PRIMARY KEY (company_id, source_key, user_id)
);

-- op_key is the caller's requestId ('setup' for org.setup): one audit row per operation, so a retry
-- after a failed audit completes it instead of logging twice.
CREATE TABLE plugin_netrxn_inertia_e936d62b87.org_log (
  company_id text NOT NULL,
  seq bigserial,
  op_key text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  subject text NOT NULL,
  reason text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, seq),
  UNIQUE (company_id, op_key)
);
