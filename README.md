# Stewart Light Calculator

Stewart Light Calculator is a static, client-side educational app for Stewart Light acid-base
interpretation. The numerical source of truth lives in Python and the browser shell loads that
same package with Pyodide.

- Live app: [Stewart Light Calculator](https://reblocke.github.io/stewart-light/)
- Original manuscript: [A pragmatic approach to complex acid base disturbances of critical
  illness: the "Stewart light"](https://doi.org/10.1007/s00134-026-08416-3)

## Why This Matters

The Stewart Light paper is best understood as a hybrid Boston-plus bedside method. It keeps the
familiar clinical context, pH, severity, and Boston compensation assessment, then adds a
pH-adjusted partition of the metabolic SBE into strong-ion/chloride effects, albumin/weak-acid
effects, and residual unmeasured ions. The goal is not to replace classical acid-base reasoning,
but to make complex ICU acid-base states easier to teach and inspect when several processes are
moving at the same time.

The key practical distinction is that Boston rules ask whether respiratory compensation is
appropriate, while Stewart Light asks what the metabolic abnormality is made of. A normal total
SBE can reflect true metabolic normality, or it can be the numerical sum of opposing
abnormalities. Separating the chloride/SID, albumin, and residual unmeasured-ion components helps
make those offsets visible in settings such as DKA, sepsis, intoxications, vomiting, fluid therapy,
diuresis, and renal replacement therapy, while remaining a pragmatic bedside approximation rather
than a full physicochemical reconstruction.

For the strong-ion term, the browser shows the pH-adjusted SID reference explicitly:
`35 + 15 * (7.40 - pH)` outside pH `7.30-7.50`, equivalent to `1.5 mmol/L` per
`0.10` pH unit away from `7.40`.

## Medical Disclaimer

This application is an educational and clinical reasoning aid. It is not a medical device, does
not replace clinician judgment, and should not be used as the sole basis for diagnosis or
treatment.

## Privacy

Calculations run entirely in the browser. No patient data are transmitted to a server by this app,
and inputs are not written to the URL, local storage, or browser storage by the application.

## Quickstart

```bash
uv sync --locked
uv run playwright install chromium
make verify
make serve
```

Then open `http://127.0.0.1:8000`.

## Common Commands

```bash
make stage-web   # copy src/stewartlight into web/assets/py/stewartlight
make fmt         # format Python files with Ruff
make fmt-check   # check Python formatting
make lint        # lint Python files with Ruff
make test        # run non-E2E pytest tests
make e2e         # run Playwright browser smoke tests
make verify      # run the full local verification suite
make serve       # stage and serve web/ locally on port 8000
```

## Python API

```python
from stewartlight import AcidBaseInput, calculate_stewart_light

result = calculate_stewart_light(
    AcidBaseInput(
        ph=7.22,
        pco2_mmhg=25.0,
        hco3_mmol_l=10.0,
        sbe_mmol_l=-18.0,
        na_mmol_l=140.0,
        cl_mmol_l=104.0,
        albumin_g_l=40.0,
        lactate_mmol_l=6.0,
    )
)

payload = result.to_dict()
```

The core calculator uses canonical units only: PaCO2 in mmHg and albumin in g/L. UI-facing unit
conversion helpers live in `stewartlight.units`. Optional phosphate is accepted in canonical
`mmol/L` for the advanced bedside decomposition only.

## Browser App

The static web app provides a single-page workflow with blood-gas and chemistry inputs, explicit
unit controls, example cases, structured Boston and Stewart Light results, cautions, and a
visual explanation layer. `web/app.js` is the browser module entrypoint; focused modules under
`web/js/` handle examples, input parsing, worker lifecycle, textual rendering, and SVG visuals.
The browser sends calculations to `web/pyodide_worker.js`, which normalizes units and calls the
staged Python package through Pyodide.

The result view follows the Stewart Light workflow: Step 1 keeps clinical context, pH severity,
and Boston-style compensation visible; Steps 2-4 partition measured SBE into SID/chloride,
albumin/weak-acid, and residual unmeasured-ion components; the synthesis section then combines
the Boston and Stewart Light views with cautions and context checks. The base-excess teaching
miniatures are fixed synthetic examples, not values calculated from user-entered inputs.

After calculation, corrected anion-gap context, a pH-to-hydrogen teaching chip, laboratory
caveats, and follow-up considerations appear as context around the primary Stewart Light/Boston
output. The physicochemical water/chloride/albumin/other decomposition is checked by default; the
SBE-vs-PaCO2 Boston compensation map is opt-in. These panels augment the primary interpretation
and do not replace clinical context.

## Repository Layout

- `src/stewartlight/` - Python package and numerical core.
- `scripts/` - automation such as staging the Python package for the browser.
- `web/` - static GitHub Pages app shell.
- `web/js/` - browser-native ES modules used by `web/app.js`.
- `web/assets/py/stewartlight/` - staged copy of the Python package consumed by Pyodide.
- `tests/` - unit, staging, smoke, and Playwright E2E tests.
- `docs/` - architecture decisions, clinical scope, references, and deployment notes.

## Architecture

The browser app has no backend, database, telemetry, or PHI storage. `make stage-web` copies the
Python package into `web/assets/py/`, and `web/pyodide_worker.js` loads that staged package inside
Pyodide. The JavaScript UI modules perform form validation and display formatting, but the
numerical calculation remains in Python. This keeps local tests and browser execution pointed at
the same implementation.

## Deployment

GitHub Actions runs CI on pull requests and pushes to `main`. The Pages workflow stages the Python
package and deploys the `web/` directory as the static site artifact.
