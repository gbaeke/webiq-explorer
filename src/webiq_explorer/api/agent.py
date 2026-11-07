"""The popup assistant's routes. The browser keeps a thread id (sessionStorage); the server keeps the conversation
in memory under it."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from pydantic import Field

from ..agent import Assistant
from .errors import ApiError
from .webiq_models import (
    AutoResponse,
    BrowseResponse,
    ImagesResponse,
    NewsResponse,
    VideosResponse,
    WebResponse,
    Wire,
)

ThreadId = Annotated[str, Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")]


class AskIn(Wire):
    thread_id: ThreadId
    question: Annotated[str, Field(min_length=1, max_length=8000)]


class ToolStep(Wire):
    """One MCP tool call. Exactly one of the result fields is set, named after the tool, unless the call failed."""

    tool: str
    args: dict[str, Any]
    cost_usd: float = Field(description="list price of the Web IQ call; 0 when it failed")
    error: str | None = None
    web: WebResponse | None = None
    news: NewsResponse | None = None
    images: ImagesResponse | None = None
    videos: VideosResponse | None = None
    browse: BrowseResponse | None = None
    auto: AutoResponse | None = None
    other: dict[str, Any] | None = Field(None, description="a tool this app has no model for yet")


class Turn(Wire):
    question: str
    answer: str = Field(description="markdown, with sources as links")
    steps: list[ToolStep]
    input_tokens: int
    output_tokens: int
    elapsed_ms: int | None = Field(None, description="set on the answer to a question, not in the history")


class Thread(Wire):
    thread_id: str
    model: str
    turns: list[Turn]


def get_assistant(request: Request) -> Assistant:
    if not request.app.state.settings.agent_configured:
        raise ApiError("not_configured", "The assistant needs WEBIQ_API_KEY and AGENT_* settings in .env.", 503)
    return request.app.state.assistant


AssistantDep = Annotated[Assistant, Depends(get_assistant)]

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/ask", response_model_exclude_none=True)
async def ask_agent(body: AskIn, assistant: AssistantDep) -> Turn:
    return Turn.model_validate(await assistant.ask(body.thread_id, body.question))


@router.get("/threads/{thread_id}", response_model_exclude_none=True)
async def get_thread(thread_id: str, assistant: AssistantDep) -> Thread:
    turns = await assistant.history(thread_id)
    return Thread(thread_id=thread_id, model=assistant.model_name, turns=[Turn.model_validate(t) for t in turns])


@router.delete("/threads/{thread_id}", status_code=204)
async def clear_thread(thread_id: str, assistant: AssistantDep) -> None:
    await assistant.clear(thread_id)
