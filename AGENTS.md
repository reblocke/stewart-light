# Codex AGENTS

## Purpose

- This repository contains the Stewart Light calculator core and static web foundation.
- The Python package is `stewartlight`.
- The numerical source of truth lives in `src/stewartlight/`.
- The static GitHub Pages app lives in `web/` and imports staged Python through Pyodide.

## Repo Map

- `src/stewartlight/` - browser-friendly Python package and numerical core.
- `scripts/stage_web_python.py` - copies the Python package into `web/assets/py/stewartlight/`.
- `web/` - static client-only app shell for GitHub Pages.
- `tests/` - unit, smoke, staging, and Playwright E2E tests.
- `docs/` - architecture decisions, clinical scope, references, and deployment notes.

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

## Project Conventions

- Runtime package dependencies should remain standard-library-only unless a ticket justifies more.
- Keep calculator logic in Python first; JavaScript should handle UI, worker lifecycle, and rendering.
- Run `make stage-web` after package changes that the browser app must consume.
- The public calculation API is `calculate_stewart_light(AcidBaseInput(...))`.
- The core calculator consumes canonical units only: PaCO2 in mmHg and albumin in g/L.
- Do not estimate missing SBE in v1; measured blood-gas SBE is required.
- Do not add a backend, database, telemetry, PHI storage, or URL persistence of patient values for v1.
- Do not copy, trace, or recreate figures from the Stewart Light paper.
- Keep public clinical language conservative: educational / clinical reasoning support, not a medical device.

## Done Criteria

- `uv sync --locked` works from the repo root.
- `make verify` passes locally.
- `make serve` launches the static app from `web/`.
- The web page loads Pyodide, imports the staged `stewartlight` package, and renders a synthetic
  calculation payload.
- README and web footer include the required medical disclaimer and client-side privacy statement.
- Architecture choices are documented in `docs/DECISIONS.md`.
