"""Offline structural checks only; never contacts Docker, a relay, or a provider."""
from pathlib import Path
import json
import re
import unittest
import yaml

ROOT = Path(__file__).resolve().parent


def validate(config):
    assert config['name'] == 'buzzpreprod'
    assert set(config['services']) == {'relay', 'postgres', 'redis', 'minio', 'minio-init'}
    assert config['networks']['buzz-net']['internal'] is True
    assert not config['networks']['buzz-net'].get('external', False)
    assert 'name' not in config['networks']['buzz-net']
    assert 'driver_opts' not in config['networks']['buzz-net']
    for name, service in config['services'].items():
        assert 'network_mode' not in service
        assert not service.get('privileged', False)
        assert service['networks'] == ['buzz-net']
        assert service.get('ports', []) == (['127.0.0.1:${BUZZ_HTTP_PORT:-13000}:3000'] if name == 'relay' else [])
        for volume in service.get('volumes', []):
            assert volume.split(':')[0] in config['volumes'], 'host bind mount forbidden'
    for volume in config['volumes'].values():
        assert not volume.get('external', False)
        assert 'name' not in volume
        assert 'driver' not in volume
        assert 'driver_opts' not in volume
    relay = config['services']['relay']
    assert relay['env_file'] == ['.env.preprod']
    for key in ['BUZZ_REQUIRE_AUTH_TOKEN', 'BUZZ_REQUIRE_RELAY_MEMBERSHIP']:
        assert relay['environment'][key] == 'true'
    assert relay['environment']['BUZZ_PUSH_ENABLED'] == 'false'
    for service in ['relay', 'postgres', 'redis']:
        assert ':?' in config['services'][service]['image']
    for service in ['minio', 'minio-init']:
        assert re.search(r'@sha256:[0-9a-f]{64}$', config['services'][service]['image'])


class ScaffoldTests(unittest.TestCase):
    def setUp(self):
        self.config = yaml.safe_load((ROOT / 'compose.preprod.yml').read_text())

    def test_isolated_structure(self):
        validate(self.config)

    def test_rejects_public_bind(self):
        self.config['services']['relay']['ports'] = ['13000:3000']
        with self.assertRaises(AssertionError):
            validate(self.config)

    def test_rejects_existing_volume(self):
        self.config['volumes']['buzz-postgres-data']['external'] = True
        with self.assertRaises(AssertionError):
            validate(self.config)

    def test_rejects_open_membership(self):
        self.config['services']['relay']['environment']['BUZZ_REQUIRE_RELAY_MEMBERSHIP'] = 'false'
        with self.assertRaises(AssertionError):
            validate(self.config)

    def test_rejects_volume_host_bind_options(self):
        self.config['volumes']['buzz-postgres-data']['driver_opts'] = {'type': 'none', 'o': 'bind', 'device': '/existing/runtime'}
        with self.assertRaises(AssertionError):
            validate(self.config)

    def test_rejects_shared_network_name(self):
        self.config['networks']['buzz-net']['name'] = 'existing-network'
        with self.assertRaises(AssertionError):
            validate(self.config)

    def test_rejects_network_egress(self):
        self.config['networks']['buzz-net']['internal'] = False
        with self.assertRaises(AssertionError):
            validate(self.config)

    def test_unset_credentials_and_origins(self):
        env = dict(line.split('=', 1) for line in (ROOT / '.env.preprod.example').read_text().splitlines() if line and not line.startswith('#'))
        for key in ['BUZZ_IMAGE', 'POSTGRES_IMAGE', 'REDIS_IMAGE', 'BUZZ_DOMAIN', 'RELAY_URL', 'BUZZ_RELAY_PRIVATE_KEY', 'BUZZ_GIT_HOOK_HMAC_SECRET', 'RELAY_OWNER_PUBKEY', 'POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'BUZZ_S3_ACCESS_KEY', 'BUZZ_S3_SECRET_KEY']:
            self.assertEqual(env[key], '', key)
        self.assertFalse((ROOT / '.env.preprod').exists())

    def test_exact_source_pins(self):
        sources = json.loads((ROOT / 'SOURCES.json').read_text())
        self.assertEqual(sources['buzz']['commit'], '9e8c9fc04daf20259cd259dcaec89109587cc7f5')
        self.assertEqual(sources['inertia']['commit'], '8d15eaaa514d5604244fd731982df13e9a54f810')


if __name__ == '__main__':
    unittest.main(verbosity=2)
