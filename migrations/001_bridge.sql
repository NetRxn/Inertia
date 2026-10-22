CREATE TABLE plugin_netrxn_inertia_e936d62b87.bridge_inbox (
 relay text NOT NULL, event_id text NOT NULL, state text NOT NULL CHECK (state IN ('applying','applied','rejected','uncertain')),
 destination jsonb NOT NULL, command jsonb NOT NULL, receipt_key text NOT NULL UNIQUE,
 outcome jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (relay,event_id)
);
CREATE TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox (
 receipt_key text PRIMARY KEY, relay text NOT NULL, event_id text NOT NULL, event jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','delivered','blocked')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (relay,event_id)
);
CREATE TABLE plugin_netrxn_inertia_e936d62b87.bridge_bindings (
 relay text NOT NULL, channel_id text NOT NULL, root_id text NOT NULL, company_id text NOT NULL, issue_id text NOT NULL,
 PRIMARY KEY (relay,channel_id,root_id)
);
CREATE TABLE plugin_netrxn_inertia_e936d62b87.bridge_pairings (
 relay text NOT NULL, company_id text NOT NULL, pubkey text NOT NULL, actor_user_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('human','agent')), active boolean NOT NULL,
 PRIMARY KEY (relay,company_id,pubkey)
);
CREATE TABLE plugin_netrxn_inertia_e936d62b87.bridge_cards (
 token text PRIMARY KEY, company_id text NOT NULL, issue_id text NOT NULL, interaction_id text NOT NULL, digest text NOT NULL
);
