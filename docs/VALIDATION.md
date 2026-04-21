# Validation

## Current Gates

- `make test` runs non-E2E tests after staging the Python package for the browser app.
- `make e2e` runs the Chromium Playwright browser suite.
- `make verify` runs format check, lint, non-E2E tests, and E2E tests.
- GitHub Actions runs the same verification path before deployment.
- Guardrail tests check local skill references, staged package parity, public result shape,
  conservative public copy, and no-storage/no-telemetry browser code.

## Validation Expectations

- Changes to calculator logic require focused unit tests and contract tests.
- Changes to Pyodide staging or browser behavior require staging plus browser smoke or E2E tests.
- Changes to clinical interpretation require tests or fixtures that pin the user-visible wording or
  returned payload fields when practical.
- Changes to result layout should include E2E checks for pre-calculation empty states, step labels,
  and result-dependent cards becoming visible only after calculation data exists.
- Any change to assumptions, units, or clinical scope must be recorded in `docs/DECISIONS.md` or an ADR.
- Browser module refactors should preserve `web/app.js` as the module entrypoint and keep
  `web/pyodide_worker.js` contract-compatible with existing tests.

## Out Of Scope

The current app is educational software. Passing these gates does not establish medical-device
validation, clinical outcome benefit, or site-specific laboratory calibration.
