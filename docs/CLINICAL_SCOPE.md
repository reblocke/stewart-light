# Clinical Scope

## Intended Use

This project is intended as an educational acid-base interpretation aid for learning and
clinical reasoning support around simplified Stewart Light partitioning and Boston-rule
compensation checks.

## Non-Goals

- It is not a full physicochemical solver.
- It is not a medical device.
- It is not an EMR integration.
- It is not a substitute for bedside clinical judgment.
- It does not store, transmit, or persist patient data by default.

## Version 1 Scope

Version 1 will support simplified Stewart Light partitioning. It will not attempt to cover every
acid-base edge case, severe physiologic exception, rare unmeasured ion scenario, or institution-
specific laboratory convention.

Future clinical logic should make unsupported cases explicit rather than silently presenting
overconfident interpretations.

## Calculation Assumptions

- The calculator requires measured blood-gas SBE in mmol/L.
- PaCO2 is normalized to mmHg before calculation.
- Albumin is normalized to g/L before calculation.
- Phosphate is optional, accepted only in mmol/L, and used only for the supplementary bedside
  decomposition.
- Browser plausible-range warnings are educational prompts and do not replace local laboratory
  reference ranges.
- Lactate, when provided, is used only to subpartition residual unmeasured-ion SBE.
- Corrected anion-gap context uses conservative teaching thresholds; local laboratory reference
  ranges should take precedence.
- The Boston-rule layer is an educational compensation check, not a complete diagnosis engine.
- The SBE-vs-PaCO2 compensation map is an educational cross-check, not a replacement for Boston
  compensation assessment.
- Positive SID contribution in suspected chronic hypercapnia may reflect renal compensation and
  should not automatically be labeled as a separate metabolic alkalosis.

## Limitations

This is a simplified bedside partition, not a full physicochemical model. The primary Stewart
Light output omits phosphate and minor cations, depends on measured blood-gas SBE, and uses
transparent heuristics for mixed-process cautions.

The follow-up considerations panel is intentionally non-diagnostic. It suggests broad categories
to consider when high-gap or residual unmeasured-anion patterns are present, but it is not a
toxicology, renal, or critical-care workup engine.
