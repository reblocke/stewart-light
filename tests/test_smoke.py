from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

STAGE_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "stage_web_python.py"
SPEC = importlib.util.spec_from_file_location("stage_web_python", STAGE_SCRIPT)
assert SPEC is not None
assert SPEC.loader is not None
stage_web_python = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage_web_python)
stage_package = stage_web_python.stage_package


def test_stage_web_python_stages_package(tmp_path: Path) -> None:
    target_dir = tmp_path / "assets" / "py" / "stewartlight"
    written_files = stage_package(Path("src/stewartlight"), target_dir)

    assert (target_dir / "__init__.py").exists()
    assert {path.name for path in written_files} >= {
        "__init__.py",
        "calculator.py",
        "enhancements.py",
        "models.py",
    }


def test_stage_web_python_excludes_bytecode_and_caches(tmp_path: Path) -> None:
    source_dir = tmp_path / "source_pkg"
    source_dir.mkdir()
    (source_dir / "__init__.py").write_text("VALUE = 1\n", encoding="utf-8")
    (source_dir / "module.pyc").write_bytes(b"compiled")
    cache_dir = source_dir / "__pycache__"
    cache_dir.mkdir()
    (cache_dir / "module.cpython-311.pyc").write_bytes(b"compiled")

    target_dir = tmp_path / "target_pkg"
    stage_package(source_dir, target_dir)

    assert (target_dir / "__init__.py").exists()
    assert not (target_dir / "module.pyc").exists()
    assert not (target_dir / "__pycache__").exists()


def test_staged_package_imports(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    package_parent = tmp_path / "assets" / "py"
    stage_package(Path("src/stewartlight"), package_parent / "stewartlight")

    for module_name in list(sys.modules):
        if module_name == "stewartlight" or module_name.startswith("stewartlight."):
            monkeypatch.delitem(sys.modules, module_name, raising=False)

    monkeypatch.syspath_prepend(str(package_parent))
    module = importlib.import_module("stewartlight")

    assert module.healthcheck()["status"] == "ok"
