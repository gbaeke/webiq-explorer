from typing import Any

import httpx2
import openai
import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel

from webiq_explorer.agent import SYSTEM_PROMPT
from webiq_explorer.api.app import create_app
from webiq_explorer.config import settings_without_env_file

THREAD = "thread-0001"


class ScriptedChatModel(GenericFakeChatModel):
    """Answers with the scripted messages in order; records what it was offered and can fail on demand."""

    offered: list[str] | None = None
    system: str | None = None
    fail_with: Exception | None = None

    def bind_tools(self, tools: Any, **_: Any) -> Any:  # pyright: ignore[reportIncompatibleMethodOverride]
        self.offered = [t.name for t in tools]
        return self

    async def _agenerate(self, messages: Any, *args: Any, **kwargs: Any) -> Any:
        if self.fail_with:
            raise self.fail_with
        self.system = messages[0].text
        return await super()._agenerate(messages, *args, **kwargs)


class SearchArgs(BaseModel):
    query: str
    maxResults: int | None = None


VIDEOS = {"videoResults": [{"title": "ACA in 5 minutes", "url": "https://v.test/1", "length": "00:05:00"}]}


def fake_tool(name: str, structured: dict, calls: list) -> BaseTool:
    """Shaped like an MCP tool from langchain-mcp-adapters: text content plus the structured result as artifact."""

    async def run(**kwargs: Any) -> tuple[str, dict]:
        calls.append((name, {k: v for k, v in kwargs.items() if v is not None}))
        return "results", {"structured_content": structured}

    return StructuredTool.from_function(
        coroutine=run,
        name=name,
        description=f"Web IQ {name}",
        args_schema=SearchArgs,
        response_format="content_and_artifact",
    )


def video_call(query: str = "aca") -> AIMessage:
    return AIMessage("", tool_calls=[{"name": "videos", "args": {"query": query, "maxResults": 5}, "id": "c1"}])


@pytest.fixture
def calls() -> list:
    return []


@pytest.fixture
def tools(calls):
    return [fake_tool("web", {"webResults": []}, calls), fake_tool("videos", VIDEOS, calls)]


def make_client(model, tools, **settings):
    s = settings_without_env_file(webiq_api_key="k", **settings)
    transport = httpx2.MockTransport(lambda _: httpx2.Response(500))
    return TestClient(create_app(s, webiq_transport=transport, agent_model=model, agent_tools=tools))


def ask(c: TestClient, question: str, thread: str = THREAD):
    return c.post("/api/agent/ask", json={"threadId": thread, "question": question})


def test_a_question_runs_the_chosen_tool_and_returns_its_typed_results(tools, calls):
    model = ScriptedChatModel(messages=iter([video_call(), AIMessage("Here is one: [ACA](https://v.test/1)")]))
    with make_client(model, tools) as c:
        res = ask(c, "find a video about Azure Container Apps")

    assert res.status_code == 200, res.text
    turn = res.json()
    assert turn["question"] == "find a video about Azure Container Apps"
    assert turn["answer"].startswith("Here is one")
    assert calls == [("videos", {"query": "aca", "maxResults": 5})]
    [step] = turn["steps"]
    assert (step["tool"], step["costUsd"]) == ("videos", 0.007)
    assert step["videos"]["videoResults"][0]["title"] == "ACA in 5 minutes"


def test_only_the_web_iq_tools_and_the_apps_prompt_reach_the_model(tools):
    """Deep Agents adds file tools, write_todos and task: the allowlist keeps them from the model."""
    model = ScriptedChatModel(messages=iter([AIMessage("Hi.")]))
    with make_client(model, tools) as c:
        ask(c, "hi")

    assert set(model.offered or []) == {"web", "videos"}
    assert (model.system or "").startswith("You are the assistant in Web IQ Explorer")


def test_the_thread_remembers_the_conversation_until_cleared(tools):
    model = ScriptedChatModel(messages=iter([video_call(), AIMessage("One video."), AIMessage("Sure.")]))
    with make_client(model, tools) as c:
        ask(c, "find a video")
        ask(c, "and news?")
        thread = c.get(f"/api/agent/threads/{THREAD}").json()
        other = c.get("/api/agent/threads/another-thread").json()
        assert c.delete(f"/api/agent/threads/{THREAD}").status_code == 204
        cleared = c.get(f"/api/agent/threads/{THREAD}").json()

    assert [(t["question"], t["answer"]) for t in thread["turns"]] == [
        ("find a video", "One video."),
        ("and news?", "Sure."),
    ]
    assert thread["turns"][0]["steps"][0]["videos"]["videoResults"]  # the cards come back with the history
    assert other["turns"] == []
    assert cleared["turns"] == []


def test_a_model_failure_is_a_bad_gateway_in_the_envelope(tools):
    req = httpx2.Request("POST", "http://gw.test/v1/responses")
    model = ScriptedChatModel(messages=iter([]), fail_with=openai.APIConnectionError(request=req))
    with make_client(model, tools) as c:
        res = ask(c, "hi")

    assert res.status_code == 502
    assert res.json()["error"]["code"] == "agent_error"


def test_a_thread_id_must_look_like_one(tools):
    with make_client(ScriptedChatModel(messages=iter([])), tools) as c:
        res = ask(c, "hi", thread="../x")

    assert res.status_code == 422


def test_without_a_web_iq_key_the_assistant_is_not_configured(tools):
    s = settings_without_env_file()
    with TestClient(create_app(s, agent_model=ScriptedChatModel(messages=iter([])), agent_tools=tools)) as c:
        res = ask(c, "hi")

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "not_configured"


def test_the_prompt_maps_requests_to_tools():
    """The routing the user relies on ("find a video" -> videos ...) lives in the prompt: keep it there."""
    for phrase in ('"find a video"', '"find news"', '"find an image"', "browse:", "web:"):
        assert phrase in SYSTEM_PROMPT
