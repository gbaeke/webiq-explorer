from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import httpx2
from fastapi import APIRouter, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool

from ..agent import Assistant, default_model, mcp_tools_loader
from ..config import Settings, get_settings
from ..middleware import RequestContext
from ..webiq import WebIQ
from . import agent, webiq
from .errors import ApiError, install_handlers

ROOT = Path(__file__).resolve().parents[3]  # the repository (or /app in the image): alembic.ini, frontend/dist


def create_app(
    settings: Settings | None = None,
    webiq_transport: httpx2.AsyncBaseTransport | None = None,  # tests pass a fake Web IQ
    agent_model: BaseChatModel | None = None,  # tests pass a scripted model
    agent_tools: list[BaseTool] | None = None,  # ... and fake tools instead of the MCP server's
) -> FastAPI:
    settings = settings or get_settings()

    async def given_tools() -> list[BaseTool]:
        return agent_tools or []

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with httpx2.AsyncClient(
            base_url=settings.webiq_base_url.rstrip("/") + "/",
            timeout=settings.webiq_timeout_seconds,
            transport=webiq_transport,
        ) as http:
            app.state.webiq = WebIQ(http, settings.webiq_api_key)
            app.state.assistant = Assistant(
                agent_model or default_model(settings),
                given_tools if agent_tools is not None else mcp_tools_loader(settings),
            )
            yield

    app = FastAPI(
        title="Web IQ Explorer",
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        lifespan=lifespan,
        # operation ids are the handlers' names: the generated client gets listNotes(), not listNotesApiNotesGet()
        generate_unique_id_function=lambda route: route.name,
    )
    app.state.settings = settings
    install_handlers(app)
    app.add_middleware(RequestContext)  # added last, so it runs first: every response gets its id and headers

    api = APIRouter(prefix="/api")

    @api.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    api.include_router(webiq.router)
    api.include_router(agent.router)
    app.include_router(api)
    _serve_frontend(app, ROOT / "frontend" / "dist")
    return app


def _serve_frontend(app: FastAPI, dist: Path) -> None:
    """The built SPA: real files as they are, every other path gets index.html (the router takes it from there)."""
    if not dist.is_dir():
        return  # not built (tests, or `npm run dev` serves it)
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise ApiError("not_found", f"No API endpoint /{path}", 404)  # never the SPA for a mistyped API call
        file = (dist / path).resolve()
        if path and file.is_file() and file.is_relative_to(dist.resolve()):
            return FileResponse(file)
        return FileResponse(dist / "index.html", headers={"Cache-Control": "no-cache"})
