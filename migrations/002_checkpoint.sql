CREATE TABLE IF NOT EXISTS "plugin_netrxn_inertia_e936d62b87".bridge_checkpoints (
 company_id text NOT NULL, relay text NOT NULL, channel_id text NOT NULL, root_id text NOT NULL,
 last_timestamp bigint NOT NULL CHECK (last_timestamp >= 0),
 PRIMARY KEY(company_id,relay,channel_id,root_id)
);
