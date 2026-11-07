"""Request and response models for every Web IQ endpoint, mirroring the API reference. Field names are camelCase
on the wire (as Web IQ has them), so the request a page builds is exactly the one sent upstream.

Responses allow extra fields: when Web IQ adds one, the explorer still shows it in the JSON view."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Query = Annotated[str, Field(min_length=1, max_length=1000)]
Language = Annotated[str, Field(min_length=2, max_length=2, description="ISO 639-1 code, e.g. en, nl")]
Region = Annotated[str, Field(min_length=2, max_length=2, description="2-letter region code, e.g. US, BE")]
Location = Annotated[str | None, Field(pattern=r"^lat:-?\d+(\.\d+)?;long:-?\d+(\.\d+)?$")]
ContentFormat = Literal["passage", "text", "html", "markdown"]
SafeSearch = Literal["off", "strict"]
MaxLength = Annotated[int, Field(ge=1, le=500_000)]
Pixels = Annotated[int | None, Field(ge=1)]


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Upstream(Wire):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="allow")


# --- requests ---------------------------------------------------------------------------------------------------------


class WebSearchIn(Wire):
    query: Query
    max_results: Annotated[int, Field(ge=1, le=50)] = 10
    language: Language = "en"
    region: Region = "US"
    location: Location = None
    content_format: ContentFormat = "passage"
    max_length: MaxLength = 3000
    safe_search: SafeSearch = "strict"


class NewsSearchIn(Wire):
    query: Query
    max_results: Annotated[int, Field(ge=1, le=20)] = 10
    language: Language = "en"
    region: Region = "US"
    location: Location = None
    content_format: ContentFormat = "passage"
    max_length: MaxLength = 3000


class ImageSearchIn(Wire):
    query: Query
    max_results: Annotated[int, Field(ge=1, le=30)] = 30
    language: Language = "en"
    region: Region = "US"
    aspect_ratio: Literal["square", "wide", "tall"] | None = None
    color: Literal["colorOnly", "monochrome"] | None = None
    image_size: Literal["small", "medium", "large", "extraLarge"] | None = None
    watermark_free: bool = False
    min_width: Pixels = None
    max_width: Pixels = None
    min_height: Pixels = None
    max_height: Pixels = None
    safe_search: SafeSearch = "strict"


class VideoSearchIn(Wire):
    query: Query
    max_results: Annotated[int, Field(ge=1, le=30)] = 30
    language: Language = "en"
    region: Region = "US"
    freshness: str | None = Field(None, description='"week", "month", "year" or an ISO 8601 interval')
    duration: Literal["short", "medium", "long"] | None = None
    resolution: Literal["360p", "480p", "720p", "1080p"] | None = None
    embeddable: list[Literal["player"]] | None = None
    enable_playlist: bool = False
    safe_search: SafeSearch = "strict"


class BrowseIn(Wire):
    url: Annotated[str, Field(min_length=1, max_length=4096)]
    query: Annotated[str | None, Field(max_length=1000, description="required for passage")] = None
    content_format: ContentFormat = "passage"
    max_length: MaxLength = 3000
    live_crawl: Literal["none", "fallback"] = "none"
    render_dynamic_pages: bool = False
    include_web_links: bool = False
    include_image_links: bool = False
    language: Language = "en"
    region: Region = "US"


AutoFilter = Literal["web", "news", "timezone", "weather", "images", "videos"]


class AutoIn(Wire):
    query: Query
    mode: Literal["fast", "advanced"] = "fast"
    max_response_length: Annotated[int, Field(ge=1500, le=500_000)] = 30_000
    response_filter: list[AutoFilter] | None = None
    language: Language = "en"
    region: Region = "US"
    location: Location = None


# --- responses --------------------------------------------------------------------------------------------------------


class WebResult(Upstream):
    title: str | None = None
    url: str | None = None
    content: str | None = None
    crawled_at: str | None = None
    last_updated_at: str | None = None
    language: str | None = None
    is_adult: bool | None = None
    content_tier: str | None = None


class QuerySignals(Upstream):
    freshness: bool | None = None


class WebResponse(Upstream):
    web_results: list[WebResult] = []
    query_signals: QuerySignals | None = None
    risk_level: str | None = None
    trace_id: str | None = None


class Thumbnail(Upstream):
    url: str | None = None
    width: int | None = None
    height: int | None = None


class NewsResult(Upstream):
    title: str | None = None
    url: str | None = None
    content: str | None = None
    source: str | None = None
    thumbnail: Thumbnail | None = None
    last_updated_at: str | None = None
    crawled_at: str | None = None
    language: str | None = None
    is_adult: bool | None = None


class NewsResponse(Upstream):
    news_results: list[NewsResult] = []
    trace_id: str | None = None


class ImageResult(Upstream):
    title: str | None = None
    url: str | None = None
    host_page_url: str | None = None
    caption: str | None = None
    width: int | None = None
    height: int | None = None
    thumbnail_url: str | None = None
    last_updated_at: str | None = None
    is_adult: bool | None = None


class ImagesResponse(Upstream):
    image_results: list[ImageResult] = []
    trace_id: str | None = None


class Moment(Upstream):
    title: str | None = None
    description: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    moment_url: str | None = None


class VideoResult(Upstream):
    title: str | None = None
    url: str | None = None
    description: str | None = None
    summary: str | None = None
    published_by: str | None = None
    view_count: int | None = None
    length: str | None = None
    thumbnail_url: str | None = None
    embedding_url: str | None = None
    allow_https_embedding: bool | None = None
    allow_mobile_embedding: bool | None = None
    width: int | None = None
    height: int | None = None
    last_updated_at: str | None = None
    best_moment_index: int | None = None
    moments: list[Moment] = []
    is_adult: bool | None = None


class PlaylistVideo(Upstream):
    title: str | None = None
    description: str | None = None
    url: str | None = None


class Playlist(Upstream):
    title: str | None = None
    description: str | None = None
    videos: list[PlaylistVideo] = []


class VideosResponse(Upstream):
    video_results: list[VideoResult] = []
    playlists: list[Playlist] = []
    trace_id: str | None = None


class BrowseResponse(Upstream):
    url: str | None = None
    title: str | None = None
    content: str | None = None
    last_updated_at: str | None = None
    crawled_at: str | None = None
    retry_after: str | None = Field(None, description="set on a 202: a live crawl runs, retry after this time")
    is_adult: bool | None = None
    trace_id: str | None = None


class AutoEvidence(Upstream):
    type: str = Field(description="text, media/image, media/video, structured/weather or structured/timeZone")
    content: Any = None
    thumbnail: Thumbnail | None = None


class AutoCitation(Upstream):
    content_source: str | None = None
    title: str | None = None
    url: str | None = None
    last_updated_at: str | None = None
    crawled_at: str | None = None
    language: str | None = None
    is_adult: bool | None = None


class AutoResult(Upstream):
    evidence: AutoEvidence
    citations: list[AutoCitation] = []


class AutoResponse(Upstream):
    results: list[AutoResult] = []
    trace_id: str | None = None


# --- what the explorer returns ----------------------------------------------------------------------------------------


class Call[T](Wire):
    """One upstream call: what was sent, what came back, and what it took."""

    endpoint: str = Field(description="the Web IQ path, e.g. search/web")
    status: int = Field(description="Web IQ's HTTP status (2xx)")
    elapsed_ms: int
    cost_usd: float = Field(description="list price of this call; 0 for a 202 or a free endpoint")
    request: dict[str, Any] = Field(description="the JSON body sent to Web IQ")
    response: T


class Status(Wire):
    configured: bool
    base_url: str
    prices_usd_per_1000_calls: dict[str, float]
