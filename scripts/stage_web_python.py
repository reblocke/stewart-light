from __future__ import annotations

from pathlib import Path
from shutil import copytree, rmtree


def _ignored_files(_directory: str, names: list[str]) -> set[str]:
    return {
        name
        for name in names
        if name == "__pycache__" or name.endswith((".pyc", ".pyo")) or name == ".DS_Store"
    }


def stage_package(source_dir: Path, target_dir: Path) -> list[Path]:
    """Copy the Python package into the static web asset tree."""

    source_dir = source_dir.resolve()
    target_dir = target_dir.resolve()

    if not source_dir.exists():
        raise FileNotFoundError(f"Missing source package directory: {source_dir}")
    if not (source_dir / "__init__.py").is_file():
        raise FileNotFoundError(f"Missing package __init__.py in: {source_dir}")

    if target_dir.exists():
        rmtree(target_dir)

    copytree(source_dir, target_dir, ignore=_ignored_files)
    return sorted(path for path in target_dir.rglob("*") if path.is_file())


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    stage_package(
        source_dir=project_root / "src" / "stewartlight",
        target_dir=project_root / "web" / "assets" / "py" / "stewartlight",
    )


if __name__ == "__main__":
    main()
