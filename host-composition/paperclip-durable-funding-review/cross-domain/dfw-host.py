"""Synthetic fixture process. Not a network endpoint or production authorizer."""
import json
import sys
from datetime import date
from pathlib import Path

from dfw_incentives.db import Database, make_engine
from dfw_incentives.durable_native_review import DurableNativeFundingReviewService
from dfw_incentives.settings import Settings

mode, root = sys.argv[1], Path(sys.argv[2])
if mode == 'init':
    from test_native_funding_review import fixture, packet_fixture
    root.mkdir(parents=True, exist_ok=True)
    kind = sys.argv[3]
    if kind == 'proposal':
        db, old, command, _, _ = fixture(root)
    else:
        db, old, command = packet_fixture(root)
    config = {'database': str(db.engine.url), 'as_of': old.as_of.isoformat() if old.as_of else None,
              'settings': old.settings.model_dump(mode='json') if old.settings else None}
    (root/'config.json').write_text(json.dumps(config))
    binding = command['binding']
    fields = ['applicantId', 'targetId', 'targetVersion', 'kind', 'reviewerRole',
              'expectedHead', 'expectedWorkspaceHash', 'sourceScope', 'allowedEvidenceIds', 'allowedTargets']
    (root/'funding-input.json').write_text(json.dumps({field: binding[field] for field in fields}))
    print(json.dumps({'state':'fixture_ready','kind':kind}))
else:
    config = json.loads((root/'config.json').read_text())
    receipt = json.loads((root/'native-receipt.json').read_text())
    db = Database(make_engine(config['database']))
    binding = receipt['command']['binding']
    def reader(identifier):
        if mode.endswith('_offline'):
            raise ConnectionError('synthetic host disconnect')
        return receipt if identifier == receipt['acceptanceId'] else None
    service = DurableNativeFundingReviewService(db, bindings=[binding], read_acceptance=reader,
        authorize_domain=lambda session, b, actor: actor == binding['reviewerUserId'] and b['sourceScope']=='public',
        authorize_cancellation=lambda session, b, actor: actor=='fixture_operator',
        as_of=date.fromisoformat(config['as_of']) if config['as_of'] else None,
        settings=Settings(**config['settings']) if config['settings'] else None)
    identifier=receipt['acceptanceId']
    if mode.startswith('apply'):
        result=service.apply_accepted(identifier)
    elif mode.startswith('cancel'):
        result=service.cancel_accepted(identifier,'fixture_operator')
    else:
        result=service.read_accepted_outcome(identifier)
    print(json.dumps(result))
