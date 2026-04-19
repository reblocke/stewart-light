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

The repository's Pages source should be set to GitHub Actions.

## Deployment Invariants

- No server process is deployed.
- No database is deployed.
- No telemetry is configured.
- No patient data are intentionally stored or transmitted by this app.
