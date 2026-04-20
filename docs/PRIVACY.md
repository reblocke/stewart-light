# Privacy

## Position

The v1 app is client-side only. It should not send calculator inputs to a backend, analytics service,
database, log sink, or URL query string.

## Rules

- Do not store, transmit, or persist patient-entered values.
- Use synthetic examples in tests, docs, screenshots, and public copy.
- Keep telemetry, external APIs, uploads, and saved sessions out of scope unless a future decision
  explicitly documents the data path and compliance assumptions.
- Treat browser worker messages and console output as sensitive surfaces; do not log input payloads.

## Verification

Privacy-affecting changes should be reviewed with `.agents/skills/privacy-no-phi-review/SKILL.md`
and documented in `docs/DECISIONS.md` or an ADR.

The automated test suite includes guardrails for browser JavaScript storage, telemetry, and console
logging APIs, plus an E2E check that calculations do not write entered values to the URL or browser
storage.
