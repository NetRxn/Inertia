"""Stdlib-only tests; never import or execute the private application."""
import hashlib
import importlib.util
import tempfile
import unittest
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

HELPER = Path(__file__).with_name("fixture_database.py")
NAMES = ("Database", "init_db", "make_engine", "ApplicantProfile", "ApplicationPacket",
         "Opportunity", "OpportunityMatch", "UTC", "datetime", "Decimal", "Path")


class FixtureDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.source = Path(self.directory.name) / "test_codex_agents.py"
        self.namespace = {name: object() for name in NAMES}
        self.namespace.update(UTC=UTC, datetime=datetime, Decimal=Decimal, Path=Path)

    def load(self, source, namespace=None):
        self.assertTrue(HELPER.exists(), "AST-only trusted fixture helper is not implemented")
        spec = importlib.util.spec_from_file_location("fixture_database_under_test", HELPER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.source.write_text(source, encoding="utf-8")
        return module.load_database_helper(self.source, self.namespace if namespace is None else namespace)

    def test_unrelated_imports_and_module_side_effects_never_execute(self):
        selected = "def _database(tmp_path: Path):\n    return (tmp_path, Decimal('1.25'))"
        source = "import nonexistent_unrelated_private_dependency\nraise RuntimeError('module executed')\n" + selected + "\n"
        helper, receipt = self.load(source)
        self.assertEqual(helper(Path("fixture")), (Path("fixture"), Decimal("1.25")))
        self.assertEqual(receipt, {
            "method": "ast-selected-function-v1", "source_file": str(self.source.resolve()),
            "source_sha256": hashlib.sha256(source.encode()).hexdigest(),
            "function_name": "_database", "function_sha256": hashlib.sha256(selected.encode()).hexdigest(),
        })

    def test_future_annotations_are_preserved_without_evaluating_missing_types(self):
        helper, _ = self.load("def _database(tmp_path: Path) -> UnavailablePrivateType:\n    return tmp_path\n")
        self.assertEqual(helper.__annotations__, {"tmp_path": "Path", "return": "UnavailablePrivateType"})
        self.assertEqual(helper(Path("fixture")), Path("fixture"))

    def test_only_explicit_required_namespace_is_supplied(self):
        helper, _ = self.load("def _database(tmp_path):\n    return (Database, init_db, make_engine, ApplicantProfile, ApplicationPacket, Opportunity, OpportunityMatch)\n")
        self.assertEqual(helper(None), tuple(self.namespace[name] for name in NAMES[:7]))
        for namespace in [{}, {**self.namespace, "unrelated": object()}]:
            with self.subTest(keys=list(namespace)), self.assertRaises(ValueError):
                self.load("def _database(tmp_path):\n    return tmp_path\n", namespace)

    def test_missing_ambiguous_async_and_decorated_helpers_are_rejected(self):
        for source in ["def other():\n    pass\n",
                       "def _database(p):\n    pass\ndef _database(p):\n    pass\n",
                       "async def _database(p):\n    pass\n",
                       "@unknown_decorator\ndef _database(p):\n    pass\n"]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                self.load(source)

    def test_assignment_and_import_shadowing_are_rejected(self):
        helper = "def _database(p):\n    return p\n"
        for shadow in ["_database = None\n", "_database: object = None\n",
                       "other, _database = (1, 2)\n", "import unrelated as _database\n",
                       "from unrelated import _database\n", "if True:\n    _database = None\n"]:
            with self.subTest(shadow=shadow), self.assertRaises(ValueError):
                self.load(helper + shadow)

    def test_unrelated_source_changes_have_distinct_full_file_identity(self):
        selected = "def _database(p):\n    return p\n"
        _, first = self.load("import unrelated_one\n" + selected)
        _, second = self.load("import unrelated_two\n" + selected)
        self.assertNotEqual(first["source_sha256"], second["source_sha256"])
        self.assertEqual(first["function_sha256"], second["function_sha256"])


if __name__ == "__main__":
    unittest.main()
