"""One route per Web IQ endpoint. Each takes the endpoint's own parameters, forwards them unchanged, and returns
the upstream response wrapped in a Call (what was sent, status, latency, list price)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from ..webiq import PRICE_PER_1K_USD, WebIQ
from .webiq_models import (
    AutoIn,
    AutoResponse,
    BrowseIn,
    BrowseResponse,
    Call,
    ImageSearchIn,
    ImagesResponse,
    NewsResponse,
    NewsSearchIn,
    Status,
    Upstream,
    VideoSearchIn,
    VideosResponse,
    WebResponse,
    WebSearchIn,
    Wire,
)


def get_webiq(request: Request) -> WebIQ:
    return request.app.state.webiq


WebIQDep = Annotated[WebIQ, Depends(get_webiq)]

router = APIRouter(prefix="/webiq", tags=["webiq"])


async def _call[T: Upstream](webiq: WebIQ, endpoint: str, body: Wire, model: type[T]) -> Call[T]:
    payload = body.model_dump(by_alias=True, exclude_none=True)
    up = await webiq.post(endpoint, payload)
    return Call[T](
        endpoint=endpoint,
        status=up.status,
        elapsed_ms=up.elapsed_ms,
        cost_usd=up.cost_usd,
        request=payload,
        response=model.model_validate(up.body),
    )


@router.get("/status")
async def webiq_status(webiq: WebIQDep, request: Request) -> Status:
    return Status(
        configured=webiq.configured,
        base_url=request.app.state.settings.webiq_base_url,
        prices_usd_per_1000_calls=PRICE_PER_1K_USD,
    )


@router.post("/web", response_model_exclude_none=True)
async def search_web(body: WebSearchIn, webiq: WebIQDep) -> Call[WebResponse]:
    return await _call(webiq, "search/web", body, WebResponse)


@router.post("/news", response_model_exclude_none=True)
async def search_news(body: NewsSearchIn, webiq: WebIQDep) -> Call[NewsResponse]:
    return await _call(webiq, "search/news", body, NewsResponse)


@router.post("/images", response_model_exclude_none=True)
async def search_images(body: ImageSearchIn, webiq: WebIQDep) -> Call[ImagesResponse]:
    return await _call(webiq, "search/images", body, ImagesResponse)


@router.post("/videos", response_model_exclude_none=True)
async def search_videos(body: VideoSearchIn, webiq: WebIQDep) -> Call[VideosResponse]:
    return await _call(webiq, "search/videos", body, VideosResponse)


@router.post("/browse", response_model_exclude_none=True)
async def browse(body: BrowseIn, webiq: WebIQDep) -> Call[BrowseResponse]:
    return await _call(webiq, "browse", body, BrowseResponse)


@router.post("/auto", response_model_exclude_none=True)
async def auto(body: AutoIn, webiq: WebIQDep) -> Call[AutoResponse]:
    return await _call(webiq, "auto", body, AutoResponse)
