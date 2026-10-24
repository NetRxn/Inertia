-- QUALIFICATION ONLY. Not a deployable migration or approved retention policy.
-- These guards intentionally block company deletion containing acceptances.
-- Production must supply an approved archive/retention lifecycle instead.
CREATE UNIQUE INDEX IF NOT EXISTS qualification_funding_acceptance_key
ON activity_log(company_id, ((details->'command'->>'decisionKey')))
WHERE action='funding.review.accepted' AND actor_type='user' AND entity_type='issue'
  AND agent_id IS NULL AND run_id IS NULL AND details->>'schema'='inertia.funding-acceptance.v1';
CREATE OR REPLACE FUNCTION qualification_guard_funding_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='TRUNCATE' THEN
    IF EXISTS (SELECT 1 FROM activity_log WHERE action='funding.review.accepted' AND actor_type='user' AND details->>'schema'='inertia.funding-acceptance.v1') THEN
      RAISE EXCEPTION 'qualification-only receipt retention blocks truncation';
    END IF;
    RETURN NULL;
  END IF;
  IF OLD.action='funding.review.accepted' AND OLD.actor_type='user' AND OLD.details->>'schema'='inertia.funding-acceptance.v1' THEN
    RAISE EXCEPTION 'qualification-only acceptance receipt is immutable; approved archive lifecycle required';
  END IF;
  IF TG_OP='UPDATE' AND NEW.action='funding.review.accepted' AND NEW.actor_type='user' AND NEW.details->>'schema'='inertia.funding-acceptance.v1' THEN
    RAISE EXCEPTION 'qualification-only acceptance cannot be minted by update';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
DROP TRIGGER IF EXISTS qualification_immutable_funding_acceptance ON activity_log;
CREATE TRIGGER qualification_immutable_funding_acceptance BEFORE UPDATE OR DELETE ON activity_log FOR EACH ROW EXECUTE FUNCTION qualification_guard_funding_acceptance();
DROP TRIGGER IF EXISTS qualification_no_truncate_funding_acceptance ON activity_log;
CREATE TRIGGER qualification_no_truncate_funding_acceptance BEFORE TRUNCATE ON activity_log FOR EACH STATEMENT EXECUTE FUNCTION qualification_guard_funding_acceptance();
