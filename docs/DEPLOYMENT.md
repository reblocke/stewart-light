# Deployment

The app is a static GitHub Pages site.

## Local

```bash
uv sync --locked
uv run playwright install chromium
make verify
make serve
```

Open `http://127.0.0.1:8000`.

## GitHub Pages

The Pages workflow stages the Python package into `web/assets/py/stewartlight/`, uploads `web/`
as the Pages artifact, and deploys it with GitHub's Pages actions.

The repository's Pages source must be enabled once and set to GitHub Actions before the workflow
can deploy. After that one-time repository setting exists, `.github/workflows/pages.yml` should
configure, upload, and deploy the static artifact without trying to create the Pages site during
each run.

## Deployment Invariants

- No server process is deployed.
- No database is deployed.
- No telemetry is configured.
- No patient data are intentionally stored or transmitted by this app.
