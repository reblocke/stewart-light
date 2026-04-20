# Codex AGENTS

## Purpose
- This repository contains the Stewart Light educational calculator core and static GitHub Pages app.
- The Python package is `stewartlight`; the static browser app lives in `web/` and imports staged Python through Pyodide.
- Keep clinical language conservative: educational and clinical reasoning support only, not medical-device functionality.

## Repo Map
- `src/stewartlight/` - browser-friendly Python package and numerical source of truth.
- `web/` - static client-only app shell, worker, styles, and staged Python package.
- `scripts/stage_web_python.py` - copies `src/stewartlight/` into `web/assets/py/stewartlight/`.
- `tests/` - unit, smoke, contract, staging, and Playwright E2E tests.
- `docs/` - clinical scope, privacy, validation, references, deployment, decisions, and ADRs.
- `.agents/skills/` - focused local workflows for recurring agent tasks.

## Commands
- Setup: `uv sync --locked`
- Stage browser Python: `make stage-web`
- Format: `make fmt`
- Format check: `make fmt-check`
- Lint: `make lint`
- Unit/smoke tests: `make test`
- Browser E2E tests: `make e2e`
- Full verification: `make verify`
- Local web app: `make serve`

## Authority
1. User request and clinical-scope constraints in `docs/CLINICAL_SCOPE.md`.
2. `README.md`, `docs/DECISIONS.md`, `docs/VALIDATION.md`, `docs/PRIVACY.md`, and this file.
3. Existing code and tests.

If requirements conflict, preserve current behavior unless the task explicitly changes it, then record the decision in `docs/DECISIONS.md` or a new ADR under `docs/adr/`.

## Working Rules
- Before non-trivial edits, state assumptions, ambiguities, tradeoffs, a brief plan, risks, and verification commands.
- Keep changes small and directly tied to the request; do not make drive-by refactors.
- Keep `src/stewartlight/` as the calculation source of truth; run staging rather than hand-editing duplicated Python under `web/assets/py/stewartlight/`.
- Runtime package dependencies should remain standard-library-only unless a ticket justifies more.
- Do not estimate missing SBE in v1; measured blood-gas SBE is required.
- Do not add a backend, database, telemetry, PHI storage, or URL persistence of patient values for v1.
- Do not copy, trace, or recreate figures from the Stewart Light paper.
- Use `uv` with `pyproject.toml` and `uv.lock`; use Ruff only for formatting/linting.

## Skill Triggers
- Planning a non-trivial change: `.agents/skills/implementation-strategy/SKILL.md`.
- Verifying a code change: `.agents/skills/code-change-verification/SKILL.md`.
- Updating docs after behavior/workflow changes: `.agents/skills/docs-sync/SKILL.md`.
- Preparing PR text: `.agents/skills/pr-draft-summary/SKILL.md`.
- Reviewing numerical/statistical behavior: `.agents/skills/scientific-validation/SKILL.md`.
- Changing the static browser app or Pyodide staging: `.agents/skills/static-browser-pyodide-verification/SKILL.md`.
- Editing clinical, privacy, public-copy, or provenance surfaces: use the matching focused skill in `.agents/skills/`.

## Done Criteria
- `uv sync --locked` works from the repo root.
- `make verify` passes locally.
- Browser-facing package changes are staged and verified.
- README, UI/footer copy, and docs retain the required medical disclaimer and client-side privacy position.
- The final report names changed files, verification commands, and any remaining risks.
