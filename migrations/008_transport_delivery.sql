-- The existing outbox owns transport identity and uncertain delivery history.
-- Old rows may already have reached the relay; absence of history is not proof
-- of non-delivery. Do not regenerate their signature or invented wire bytes.
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox ADD COLUMN event_bytes text;
ALTER TABLE plugin_netrxn_inertia_e936d62b87.bridge_outbox ADD COLUMN delivery_attempted boolean NOT NULL DEFAULT true;
-- New writes explicitly supply the original bytes and delivery_attempted=false.
