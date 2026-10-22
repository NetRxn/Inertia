CREATE TABLE IF NOT EXISTS "plugin_netrxn_inertia_e936d62b87".bridge_runtime (
 company_id text NOT NULL, relay text NOT NULL, state_key text NOT NULL, value jsonb NOT NULL,
 PRIMARY KEY(company_id,relay,state_key)
);
CREATE TABLE IF NOT EXISTS "plugin_netrxn_inertia_e936d62b87".bridge_outbox_scopes (
 receipt_key text PRIMARY KEY, company_id text NOT NULL, issue_id text NOT NULL
);
