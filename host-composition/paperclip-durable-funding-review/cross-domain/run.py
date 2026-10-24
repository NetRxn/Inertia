"""Run real pinned native PostgreSQL capture into actual disposable DFW domain service."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

here = Path(__file__).resolve().parent
dfw = Path(os.environ['DFW_PROJECT_ROOT']).resolve()
native = Path(os.environ['NATIVE_CAPTURE_ROOT']).resolve()
env = dict(os.environ, PYTHONPATH=str(dfw/'src')+os.pathsep+str(dfw/'tests'))
native_env = dict(env)
native_env.pop('DFW_PROJECT_ROOT', None)  # Project location is not database routing authority.

def host(mode, work, *args):
    result = subprocess.run([sys.executable, str(here/'dfw-host.py'), mode, str(work), *args],
        env=env, capture_output=True, text=True, check=False, timeout=30)
    if result.returncode: raise RuntimeError(result.stderr)
    return json.loads(result.stdout)

for kind, disposition in [('proposal', 'apply'), ('packet_role', 'apply'), ('packet_role', 'cancel')]:
    with tempfile.TemporaryDirectory(prefix='durable-funding-rehearsal-') as temporary:
        work = Path(temporary)
        host('init', work, kind)
        subprocess.run(['bash', 'tests/with-disposable-pg.sh', 'node',
            'tests/capture-dfw-fixture.mjs', str(work/'funding-input.json'),
            str(work/'native-receipt.json'), '--mutate-after'], cwd=native,
            env=native_env, check=True, timeout=120, capture_output=True, text=True)
        if disposition == 'apply':
            phases = [('apply','applied'), ('apply_offline','applied'),
                      ('read_offline','applied'), ('cancel_offline','already_applied')]
        else:
            phases = [('cancel','cancelled'), ('apply_offline','cancelled'),
                      ('read_offline','cancelled')]
        for mode, expected in phases:
            actual = host(mode, work)
            assert actual['state'] == expected, (kind, mode, actual)
        print(json.dumps({'kind':kind,'disposition':disposition,'native':'actual pinned Paperclip/PostgreSQL service; synthetic authenticated human fixture',
            'post_acceptance_native_changes':'membership and role revoked; document revised',
            'funding':'actual DFW SQLite guarded domain service',
            'outcomes':dict(phases),'submitted':False,'fixture_cleanup':'temporary directory removed on exit'}))
