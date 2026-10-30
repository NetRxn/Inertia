"""Select one trusted test fixture function without importing its test module."""
import __future__
import ast
import hashlib
from pathlib import Path

REQUIRED_NAMES = frozenset((
    "Database", "init_db", "make_engine", "ApplicantProfile", "ApplicationPacket",
    "Opportunity", "OpportunityMatch", "UTC", "datetime", "Decimal", "Path",
))


def load_database_helper(source_path, namespace):
    """Compile the unchanged plain top-level _database node with explicit bindings."""
    if set(namespace) != REQUIRED_NAMES:
        raise ValueError("Fixture namespace must contain exactly the required bindings")
    source_path = Path(source_path).resolve()
    raw = source_path.read_bytes()
    source = raw.decode("utf-8")
    tree = ast.parse(source, filename=str(source_path))
    selected = [node for node in tree.body
                if isinstance(node, ast.FunctionDef) and node.name == "_database"]
    definitions = [node for node in ast.walk(tree)
                   if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
                   and node.name == "_database"]
    if len(selected) != 1 or definitions != selected or selected[0].decorator_list:
        raise ValueError("Expected exactly one plain top-level _database function")
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id == "_database" and isinstance(node.ctx, (ast.Store, ast.Del)):
            raise ValueError("Fixture function is shadowed by an assignment")
        if isinstance(node, ast.alias) and (node.asname or node.name.split(".")[0]) == "_database":
            raise ValueError("Fixture function is shadowed by an import")
    segment = ast.get_source_segment(source, selected[0])
    if segment is None:
        raise ValueError("Cannot identify the selected fixture source")
    module = ast.Module(body=selected, type_ignores=[])
    code = compile(module, str(source_path), "exec",
                   flags=__future__.annotations.compiler_flag, dont_inherit=True)
    bindings = {"__builtins__": __builtins__, "__name__": "qualified_fixture_database", **namespace}
    exec(code, bindings)
    return bindings["_database"], {
        "method": "ast-selected-function-v1", "source_file": str(source_path),
        "source_sha256": hashlib.sha256(raw).hexdigest(), "function_name": "_database",
        "function_sha256": hashlib.sha256(segment.encode("utf-8")).hexdigest(),
    }
