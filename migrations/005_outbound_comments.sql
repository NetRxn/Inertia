-- Transport tombstones prevent stale first-publication snapshots from resurfacing.
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox DROP CONSTRAINT bridge_outbox_state_check;
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox ADD CONSTRAINT bridge_outbox_state_check CHECK (state IN ('pending','delivered','blocked','suppressed'));
