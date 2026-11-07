"""Plain ASGI middleware (not BaseHTTPMiddleware, so streaming responses pass through untouched)."""

import contextvars
import logging
import secrets
import sys
import time

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
log = logging.getLogger("webiq_explorer.access")

# a strict policy for the app's own pages; the API docs (/api/docs) load Swagger UI from a CDN and are left alone.
# img-src allows any https image: Web IQ's thumbnails come from many hosts
CSP = (
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)
SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
}


class RequestContext:
    """A request id per request (the caller's X-Request-ID, or a new one): in every log line and the response
    headers, so an error a user reports can be found in the logs. Also logs the request, and sets security headers."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        given = dict(scope["headers"]).get(b"x-request-id", b"").decode()[:64]
        rid = given or secrets.token_hex(8)
        token = request_id.set(rid)
        start, status = time.perf_counter(), 500

        async def send_with_headers(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = MutableHeaders(scope=message)
                headers["x-request-id"] = rid
                for name, value in SECURITY_HEADERS.items():
                    headers.setdefault(name, value)
                if headers.get("content-type", "").startswith("text/html") and not scope["path"].startswith("/api/"):
                    headers.setdefault("content-security-policy", CSP)
            await send(message)

        try:
            await self.app(scope, receive, send_with_headers)
        finally:
            ms = round((time.perf_counter() - start) * 1000)
            log.info("%s %s %s %sms", scope["method"], scope["path"], status, ms)
            request_id.reset(token)


def setup_logging() -> None:
    """Readable log lines, each with its request id."""
    handler = logging.StreamHandler(sys.stdout)
    fmt = "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"
    handler.setFormatter(logging.Formatter(fmt))
    handler.addFilter(_add_request_id)
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
    logging.getLogger("uvicorn.access").disabled = True  # RequestContext logs requests, with their id


def _add_request_id(record: logging.LogRecord) -> bool:
    record.request_id = request_id.get()
    return True
