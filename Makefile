.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "Targets:"
	@echo "  uv-sync    Create/update the local env from uv.lock"
	@echo "  stage-web  Copy src/stewartlight into web/assets/py/stewartlight"
	@echo "  fmt        Format code (ruff)"
	@echo "  fmt-check  Check formatting (ruff)"
	@echo "  lint       Lint code (ruff)"
	@echo "  test       Run non-E2E tests (pytest)"
	@echo "  e2e        Run Playwright browser smoke tests"
	@echo "  serve      Stage and serve the web app locally"
	@echo "  verify     Run format check, lint, tests, staging, and E2E"
	@echo "  clean      Remove caches / local build artifacts"

.PHONY: uv-sync
uv-sync:
	uv sync --locked

.PHONY: stage-web
stage-web:
	uv run python scripts/stage_web_python.py

.PHONY: fmt
fmt:
	uv run ruff format .

.PHONY: fmt-check
fmt-check:
	uv run ruff format --check .

.PHONY: lint
lint:
	uv run ruff check .

.PHONY: test
test: stage-web
	uv run pytest -q -m "not e2e"

.PHONY: e2e
e2e: stage-web
	uv run pytest -q -m e2e \
		--browser chromium \
		--tracing retain-on-failure \
		--video retain-on-failure \
		--screenshot only-on-failure \
		--output test-results

.PHONY: serve
serve: stage-web
	uv run python -m http.server --bind 127.0.0.1 --directory web 8000

.PHONY: verify
verify: fmt-check lint test e2e

.PHONY: clean
clean:
	@rm -rf .pytest_cache .ruff_cache .playwright .playwright-artifacts test-results htmlcov
	@find src tests scripts web -type d -name __pycache__ -prune -exec rm -rf {} +
	@find src tests scripts web -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete
