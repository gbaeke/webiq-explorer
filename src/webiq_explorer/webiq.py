"""The Web IQ REST API (https://learn.microsoft.com/web-iq/reference/web-search), called from the server so the API
key never reaches the browser. The explorer passes requests and responses through unchanged."""

import time
from dataclasses import dataclass
from typing import Any

import httpx2

from .api.errors import ApiError

# list prices per 1,000 calls (https://learn.microsoft.com/web-iq/resources/pricing); Auto is free while in beta
PRICE_PER_1K_USD = {
    "search/web": 7.0,
    "search/news": 7.0,
    "search/images": 7.0,
    "search/videos": 7.0,
    "browse": 1.0,
    "auto": 0.0,
}


@dataclass
class Upstream:
    status: int
    body: dict[str, Any]
    elapsed_ms: int
    cost_usd: float


class WebIQ:
    def __init__(self, http: httpx2.AsyncClient, api_key: str):
        self.http, self.api_key = http, api_key

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def post(self, path: str, payload: dict[str, Any]) -> Upstream:
        """POST to a Web IQ endpoint. Any 2xx (Browse answers 202 while a live crawl runs) is returned; anything
        else becomes an ApiError that carries Web IQ's own error fields, so the explorer can show them."""
        if not self.configured:
            raise ApiError("not_configured", "WEBIQ_API_KEY is not set: add it to .env and restart.", 503)
        start = time.perf_counter()
        try:
            res = await self.http.post(path, json=payload, headers={"x-apikey": self.api_key})
        except httpx2.TimeoutException as e:
            raise ApiError("upstream_timeout", f"Web IQ did not answer in time ({e.__class__.__name__}).", 504) from e
        except httpx2.RequestError as e:
            raise ApiError("upstream_unreachable", f"Could not reach Web IQ: {e}", 502) from e
        elapsed_ms = round((time.perf_counter() - start) * 1000)
        body = _json(res)
        if res.is_success:
            cost = PRICE_PER_1K_USD.get(path, 0.0) / 1000 if res.status_code == 200 else 0.0
            return Upstream(res.status_code, body, elapsed_ms, cost)
        raise ApiError(
            body.get("errorCode") or f"upstream_{res.status_code}",
            body.get("userMessage") or res.reason_phrase or "Web IQ returned an error.",
            # Web IQ's 4xx are the caller's to fix and pass through; its 5xx and 52x are a bad gateway for us
            res.status_code if 400 <= res.status_code < 500 else 502,
            upstreamStatus=res.status_code,
            upstream=body,
            elapsedMs=elapsed_ms,
        )


def _json(res: httpx2.Response) -> dict[str, Any]:
    try:
        body = res.json()
    except ValueError:
        return {"text": res.text[:2000]} if res.text else {}
    return body if isinstance(body, dict) else {"value": body}
