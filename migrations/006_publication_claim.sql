-- A publish claim does not expire: a timed-out worker may still be running.
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox DROP CONSTRAINT bridge_outbox_state_check;
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox ADD CONSTRAINT bridge_outbox_state_check CHECK (state IN ('pending','delivered','blocked','suppressed','publishing'));
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox ADD COLUMN publish_token text;
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox ADD COLUMN suppression_requested boolean NOT NULL DEFAULT false;
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox ADD COLUMN validation_scanned_at timestamptz;
