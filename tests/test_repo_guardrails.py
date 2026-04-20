from __future__ import annotations

import re
from pathlib import Path

from stewartlight import AcidBaseInput, calculate_stewart_light

PROJECT_ROOT = Path(__file__).resolve().parents[1]

PUBLIC_COPY_PATHS = [
    PROJECT_ROOT / "README.md",
    *sorted((PROJECT_ROOT / "docs").rglob("*.md")),
    PROJECT_ROOT / "web" / "index.html",
    *sorted((PROJECT_ROOT / "web" / "js").glob("*.js")),
]

BANNED_PUBLIC_COPY_PHRASES = [
    "proves",
    "more correct",
    "superior",
    "establishes causation",
    "uniquely mechanistic",
]

BANNED_BROWSER_APIS = [
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "document.cookie",
    "navigator.sendBeacon",
    "console.",
]


def test_agent_skill_paths_named_by_agents_md_exist_with_front_matter() -> None:
    agents_text = (PROJECT_ROOT / "AGENTS.md").read_text(encoding="utf-8")
    skill_paths = sorted(set(re.findall(r"\.agents/skills/[^`\s]+/SKILL\.md", agents_text)))

    assert skill_paths
    for relative_path in skill_paths:
        path = PROJECT_ROOT / relative_path
        assert path.exists(), relative_path

        content = path.read_text(encoding="utf-8")
        assert content.startswith("---\n"), relative_path
        assert re.search(r"^name:\s+\S+", content, flags=re.MULTILINE), relative_path
        assert re.search(r"^description:\s+.+", content, flags=re.MULTILINE), relative_path


def test_staged_python_package_matches_source_after_staging() -> None:
    source_root = PROJECT_ROOT / "src" / "stewartlight"
    staged_root = PROJECT_ROOT / "web" / "assets" / "py" / "stewartlight"
    source_files = sorted(path.relative_to(source_root) for path in source_root.glob("*.py"))

    assert source_files
    for relative_path in source_files:
        assert (staged_root / relative_path).read_text(encoding="utf-8") == (
            source_root / relative_path
        ).read_text(encoding="utf-8")


def test_public_result_payload_contract_keys_are_stable() -> None:
    result = calculate_stewart_light(
        AcidBaseInput(
            ph=7.40,
            pco2_mmhg=40.0,
            hco3_mmol_l=24.0,
            sbe_mmol_l=0.0,
            na_mmol_l=140.0,
            cl_mmol_l=105.0,
            albumin_g_l=40.0,
        )
    ).to_dict()

    assert set(result) == {
        "input",
        "partition",
        "boston",
        "narrative",
        "anion_gap",
        "hydrogen",
        "advanced_bedside",
        "compensation_map",
        "chronic_hypercapnia_overlay",
        "follow_up",
    }
    assert {"sbe_total", "sbe_sid", "sbe_alb", "sbe_ui"} <= set(result["partition"])
    assert {"acid_base_state", "primary_process_guess", "expected_compensation"} <= set(
        result["boston"]
    )


def test_public_copy_surfaces_avoid_overclaiming_phrases() -> None:
    violations: list[str] = []
    for path in PUBLIC_COPY_PATHS:
        text = path.read_text(encoding="utf-8").lower()
        for phrase in BANNED_PUBLIC_COPY_PHRASES:
            if phrase in text:
                violations.append(f"{path.relative_to(PROJECT_ROOT)}: {phrase}")

    assert violations == []


def test_browser_javascript_avoids_storage_telemetry_and_console_logging() -> None:
    browser_js_paths = [
        PROJECT_ROOT / "web" / "app.js",
        PROJECT_ROOT / "web" / "pyodide_worker.js",
        *sorted((PROJECT_ROOT / "web" / "js").glob("*.js")),
    ]
    violations: list[str] = []

    for path in browser_js_paths:
        text = path.read_text(encoding="utf-8")
        for api in BANNED_BROWSER_APIS:
            if api in text:
                violations.append(f"{path.relative_to(PROJECT_ROOT)}: {api}")

    assert violations == []
