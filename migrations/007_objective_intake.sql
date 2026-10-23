-- Source snapshots remain private plugin state, never an independent execution queue.
-- Claims have no expiry: a timed-out native mutation must be reconciled, not repeated.
CREATE TABLE plugin_netrxn_inertia_e936d62b87.objective_intake (
  mapping_key text PRIMARY KEY,
  record jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(history) = 'array')
);
