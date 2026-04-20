# Decisions

Use this file to record decisions that are hard to infer from the code alone.

## 2026-04-19: Compact agent instructions with focused skills

**Context:**

The repository needs repeatable agent workflows for implementation planning, verification,
clinical scope, privacy, public copy, provenance, and Pyodide checks without making root
instructions oversized.

**Decision:**

Keep root `AGENTS.md` short and repo-specific. Move recurring workflows into focused local skills
under `.agents/skills/`. Use `docs/DECISIONS.md` or ADRs under `docs/adr/` for durable decisions.

**Consequences:**

- Agents get required constraints with less prompt overhead.
- Clinical, privacy, validation, and public-copy reviews have explicit triggers.
- Workflow guidance can stay synchronized with the package-first static-app structure.

## 2026-04-19: Static GitHub Pages app with Python source of truth

**Context:**

The project needs a Stewart Light calculator that can be deployed with GitHub Pages while keeping
one numerical implementation for tests, scripts, and the browser.

**Decision:**

Use a hybrid structure:

- `src/stewartlight/` holds the Python source of truth.
- `web/` holds the static GitHub Pages app.
- `scripts/stage_web_python.py` copies the package into `web/assets/py/stewartlight/`.
- The browser loads that staged package with Pyodide.

**Alternatives considered:**

- Plain JavaScript only: simpler runtime, but it would split the numerical source of truth.
- Server-side Python app: incompatible with the chosen static GitHub Pages deployment target.

**Consequences:**

- Local tests and browser execution exercise the same Python package.
- A staging step is required before browser tests and deployment.
- The staged copy can drift if staging is skipped, so staging is part of `serve`, tests, CI, Pages,
  and `verify`.

## 2026-04-19: Web Worker for Pyodide initialization

**Context:**

Pyodide initialization can take long enough to block the main UI thread.

**Decision:**

Initialize Pyodide in `web/pyodide_worker.js` and keep `web/app.js` responsible for DOM state.

**Alternatives considered:**

- Main-thread initialization: fewer files, but less responsive and harder to extend safely.

**Consequences:**

- The page remains responsive while Python loads.
- The worker must mount the staged Python files into Pyodide's virtual filesystem before import.

## 2026-04-19: Standard-library-only runtime package

**Context:**

The foundation ticket should not implement full calculator logic or force heavy browser packages.

**Decision:**

Keep `stewartlight` runtime dependencies empty for this ticket. Use only development dependencies
for formatting, linting, unit tests, and browser smoke tests.

**Alternatives considered:**

- Add scientific libraries now: unnecessary for the stub contract and costly in Pyodide load time.

**Consequences:**

- The lockfile stays small.
- Future tickets must justify any runtime dependency, especially browser-facing dependencies.

## 2026-04-19: Pin Pyodide to CDN version 0.29.3

**Context:**

The browser app needs Pyodide but this foundation ticket should not vendor the full runtime.

**Decision:**

Load Pyodide from `https://cdn.jsdelivr.net/pyodide/v0.29.3/full/`.

**Alternatives considered:**

- Vendor Pyodide assets: more reproducible after first load, but much larger repository footprint.

**Consequences:**

- First load depends on CDN availability.
- The version is explicit and can be revisited if deployment or reproducibility needs change.

## 2026-04-19: Require measured SBE for Stewart Light v1

**Context:**

The Stewart Light paper frames the bedside workflow around a blood gas printout and measured
standard base excess (SBE).

**Decision:**

Require `sbe_mmol_l` in `AcidBaseInput`. Do not estimate SBE from pH, bicarbonate, or PaCO2 in
v1.

**Alternatives considered:**

- Estimate SBE from pH and HCO3: convenient for incomplete inputs, but it would hide a material
  assumption and could diverge from blood-gas analyzer output.

**Consequences:**

- Missing SBE raises a clear validation error.
- A future ticket may add explicit estimated-SBE mode, but it must be opt-in and visibly labeled.

## 2026-04-19: Canonical calculation units

**Context:**

The app will eventually accept UI inputs in multiple common units, but the core formulas should not
mix conversion and calculation concerns.

**Decision:**

The core calculator consumes canonical units only: PaCO2 in mmHg and albumin in g/L. Unit
normalization lives in `stewartlight.units`.

**Alternatives considered:**

- Let `calculate_stewart_light()` accept unit flags directly: simpler at first, but it makes the
  numerical core less explicit.

**Consequences:**

- Browser/UI code must normalize units before calling the core.
- Unit conversion can be tested independently from Stewart Light formulas.

## 2026-04-19: Transparent Boston heuristics

**Context:**

Boston-style compensation rules are useful educational checks but cannot fully classify every
mixed disorder from one blood gas.

**Decision:**

Use simple, documented heuristics: pH state first, then PaCO2 and HCO3 direction relative to
common normals (`PaCO2` around 40 mmHg, `HCO3` around 24 mmol/L). Return both acute and chronic
respiratory expectations unless chronic hypercapnia is explicitly flagged.

**Alternatives considered:**

- Build a more assertive expert system: out of scope and more likely to overstate certainty.

**Consequences:**

- Interpretation language stays cautious.
- Ambiguous or near-normal pH cases are identified as possible compensated or mixed states rather
  than forced into a single diagnosis.

## 2026-04-19: Offsetting-component threshold

**Context:**

One point of Stewart Light is showing that apparently normal total SBE can hide offsetting
metabolic components.

**Decision:**

Set `offsetting_components_present=True` when `abs(sbe_total) <= 2` and the largest absolute
Stewart component is at least `3 mmol/L`.

**Alternatives considered:**

- Use no threshold: too sensitive to trivial rounding.
- Use a higher threshold: may miss educational examples where masking is visible but modest.

**Consequences:**

- The flag is deterministic and documented.
- It is a prompt for caution, not a diagnosis.

## 2026-04-19: Plain static UI with explicit worker calculations

**Context:**

Ticket 03 needs a usable browser workflow without adding a JavaScript framework or duplicating the
Stewart Light formulas in JavaScript.

**Decision:**

Build a plain HTML/CSS/JavaScript single-page app. Keep `web/app.js` responsible for form state,
validation, examples, and result rendering. Send calculation requests to `web/pyodide_worker.js`,
which normalizes units and calls the staged Python package.

**Alternatives considered:**

- Add React or Vite: unnecessary for this small static workflow and would add build complexity.
- Reimplement formulas in JavaScript: faster first load, but it would split the numerical source
  of truth.

**Consequences:**

- The browser app remains deployable as static GitHub Pages content.
- Validation and plausible-range warnings live in the UI, while canonical unit normalization and
  calculation stay in Python.
- The component visualization is intentionally a placeholder until the dedicated visualization
  ticket.

## 2026-04-19: SVG visualization with quantitative chart priority

**Context:**

Ticket 04 needs a visual explanation layer inspired by the acid-base teaching tradition without
copying the Stewart Light paper figure or adding a browser charting dependency.

**Decision:**

Render the visual system in plain SVG from the existing calculation result payload. Use a
sequential base-excess partition chart as the quantitative source of truth, then add an original
simplified calliper diagram for conceptual teaching.

**Alternatives considered:**

- Use a charting library: unnecessary for one deterministic chart and would add runtime weight.
- Recreate a Gamblegram-style ion stack: more visually familiar, but easier to overstate the
  diagram as a full electroneutrality ledger.

**Consequences:**

- Browser visuals remain static-site compatible and dependency-free.
- Playwright can test deterministic chart attributes instead of relying on screenshots.
- If the teaching diagram and quantitative chart compete, the quantitative partition chart takes
  priority.

## 2026-04-19: Reference-informed overlays stay supplementary

**Context:**

Ticket 05 adds useful teaching and guardrail ideas from additional acid-base references, but the
project should not become a competing framework selector or expert workup engine.

**Decision:**

Keep Stewart Light partitioning and Boston-rule compensation as the primary output. Add corrected
anion-gap context, pH-to-hydrogen conversion, laboratory caveats, follow-up prompts, a
water/chloride/albumin/other bedside decomposition, and an SBE-vs-PaCO2 map as supplementary
overlays.

**Alternatives considered:**

- Replace the primary interpretation with a broader Fencl-Stewart or toxicology workup: out of
  scope and more likely to overstate certainty.
- Put all overlays on screen by default: educationally dense but visually overwhelming.

**Consequences:**

- The default result remains focused on Stewart Light plus Boston compensation.
- Users can opt into advanced decomposition and compensation-map panels.
- Copy must use guarded language: augments, suggests, consistent with, and does not exclude.

## 2026-04-19: Conservative corrected anion-gap thresholds

**Context:**

Corrected anion gap is useful context, especially with hypoalbuminemia, but normal ranges vary by
laboratory method.

**Decision:**

Use conservative teaching thresholds: corrected AG below `3 mmol/L` is `low_negative`, above
`12 mmol/L` is `elevated`, and at least `16 mmol/L` is `clearly_elevated`.

**Alternatives considered:**

- More sensitive cutoffs: catch more borderline cases but risk over-alerting.
- No fixed thresholds: avoids false precision but prevents deterministic UI labels and tests.

**Consequences:**

- AG context remains a compact guardrail, not a replacement for Stewart Light.
- UI and docs explicitly remind users that local lab ranges may differ.
