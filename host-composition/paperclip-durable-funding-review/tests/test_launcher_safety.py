import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('cleanup_cluster', ROOT / 'tests/cleanup_cluster.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LauncherSafety(unittest.TestCase):
    def test_inherited_database_environment_rejected_before_launch(self):
        for key in ['PGHOST', 'PGPORT', 'PGSERVICE', 'PGOPTIONS', 'DFW_DATABASE_URL', 'NATIVE_CAPTURE_DATABASE_URL', 'NATIVE_CAPTURE_FIXTURE_ROOT']:
            with self.subTest(key=key):
                result = subprocess.run([str(ROOT / 'tests/with-disposable-pg.sh'), 'true'], env={**os.environ, key: 'not-allowed'}, capture_output=True, text=True)
                self.assertEqual(result.returncode, 2)
                self.assertIn('Refusing inherited database environment', result.stderr)

    def test_direct_fixture_without_launcher_refuses_database_access(self):
        env = {k:v for k,v in os.environ.items() if not k.startswith('NATIVE_CAPTURE_')}
        result = subprocess.run(['node', str(ROOT / 'tests/read-native-receipt.mjs'), 'not-a-uuid'], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Use the disposable native PostgreSQL launcher', result.stderr)

    def test_never_started_fixture_removed(self):
        work=Path(tempfile.mkdtemp(prefix='native-pg-qualification.'))
        result=module.cleanup(work, Path('/not-a-postgres'), False, 0.01)
        self.assertTrue(result['removed'])
        self.assertFalse(work.exists())

    def test_uncertain_start_retains_workspace(self):
        work=Path(tempfile.mkdtemp(prefix='native-pg-qualification.'))
        try:
            result=module.cleanup(work, Path('/not-a-postgres'), True, 0.01)
            self.assertEqual(result['reason'],'missing_pid_after_start')
            self.assertFalse(result['removed'])
            self.assertTrue(work.exists())
        finally:
            shutil.rmtree(work)

    def test_unrelated_live_process_is_not_signalled_or_deleted(self):
        work=Path(tempfile.mkdtemp(prefix='native-pg-qualification.'))
        try:
            (work/'db').mkdir()
            (work/'db/postmaster.pid').write_text(str(os.getpid())+'\n')
            result=module.cleanup(work, Path('/not-a-postgres'), True, 0.01)
            self.assertEqual(result['reason'],'pid_identity_mismatch')
            self.assertFalse(result['removed'])
            self.assertTrue(work.exists())
        finally:
            shutil.rmtree(work)

if __name__=='__main__': unittest.main()
