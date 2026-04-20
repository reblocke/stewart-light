# Stewart Light Calculator

Stewart Light Calculator is a static, client-side educational app for Stewart Light acid-base
interpretation. The numerical source of truth lives in Python and the browser shell loads that
same package with Pyodide.

The Stewart Light approach combines pH-adjusted base-excess partitioning with assessment of
respiratory compensation using Boston rules. The Python API and browser app calculate the Stewart
Light partition, optional lactate subpartition, Boston-style compensation assessment, and cautious
educational narrative.

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
`mmol/L` for the supplementary bedside decomposition only.

## Browser App

Deployed app: [Stewart Light Calculator](https://reblocke.github.io/stewart-light/).

The static web app provides a single-page workflow with blood-gas and chemistry inputs, explicit
unit controls, example cases, structured Boston and Stewart Light results, cautions, and a
visual explanation layer. `web/app.js` is the browser module entrypoint; focused modules under
`web/js/` handle examples, input parsing, worker lifecycle, textual rendering, and SVG visuals.
The browser sends calculations to `web/pyodide_worker.js`, which normalizes units and calls the
staged Python package through Pyodide.

Advanced educational overlays add corrected anion-gap context, a pH-to-hydrogen teaching chip,
laboratory caveats, a supplementary water/chloride/albumin/other bedside decomposition, and an
SBE-vs-PaCO2 compensation map. These augment the primary Stewart Light/Boston output and do not
replace clinical context.

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
