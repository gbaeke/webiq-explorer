# Web IQ Explorer

A local explorer for the Microsoft Web IQ APIs: one page per endpoint (web, news, images, videos, browse, auto)
that shows rendered results, raw JSON and the exact request, plus a popup Deep Agent that uses Web IQ through its
MCP server and a model through an OpenAI-compatible endpoint (agentgateway locally). The Web IQ key stays on the
server; nothing is stored on disk (Web IQ's terms forbid caching results). See README.md for setup.

FastAPI backend (`src/webiq_explorer/`), React + Vite frontend (`frontend/`) served by the backend as one app.
Python with uv, ruff and pyright.

## Commands

```bash
scripts/check.sh [--fix]          # THE quality gate: ruff, pyright, pytest, API types, prettier, oxlint, tsc
scripts/versions.sh               # what is outdated: packages and runtimes
scripts/run-local.sh [--dev]     # run the app on :8837; --dev adds Vite hot reload on :5173
cd frontend && npm run gen:api    # regenerate the API client (src/client/) after any API change
uv add PKG / uv add --dev PKG     # never pip; never edit uv.lock by hand
```

## Git workflow

- Work on a branch, never on `main`: `git switch -c <short-topic>` before the first change of a task.
- **Commit and push only when the user says so.** Don't commit "to save progress"; don't open or merge PRs unasked.
- Before proposing a commit, `scripts/check.sh` must pass.
- Commit messages: `Area: what changed` (imperative, under 72 chars), then a body explaining *why* and anything
  surprising. One logical change per commit. PRs are squash-merged with the same style.

## Layout

- `src/webiq_explorer/config.py`: every setting, from env/.env. A new setting also goes into `.env.example` (a test checks).
- `src/webiq_explorer/api/`: `app.py` builds the app (`create_app(settings)`); one router module per area; `errors.py`.
- `tests/`: pytest, one file per area.
- `frontend/src/`: `pages/` (one per screen), `components/`, `client/` (generated from the API: types, SDK and
  TanStack Query options; never edit), `lib/api.ts` (client setup, `ApiError`), `index.css` (design tokens, light and
  dark). Server data goes through TanStack Query with the generated `...Options()` / `...Mutation()`.

## Conventions

- **Simple first.** The smallest change that solves the problem. No abstraction until the third repetition; no
  options nobody asked for; no speculative layers (repositories, services, factories) over FastAPI and SQLAlchemy.
- **One source of truth.** Settings live in `config.py`.
  API types come from the backend's Pydantic models via OpenAPI (`npm run gen:api`), never written twice.
- Delete dead code instead of commenting it out; remove what a change makes unused.
- Errors: raise `ApiError(code, message, status)`; the client always gets `{"error": {"code", "message"}}`.
- Type everything (`Annotated[..., Depends()]` for dependencies, Pydantic models in and out of every route).
- Comments say *why*, not what. Docstrings on modules and on anything non-obvious.
- Tests: a test next to every behaviour change, through the HTTP API where possible. Fakes for external services,
  never mocks of our own code.
- Secrets live in `.env` (git-ignored); never in code, logs or chat.
