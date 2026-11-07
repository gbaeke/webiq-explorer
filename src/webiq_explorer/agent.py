"""The popup assistant: a LangChain Deep Agent whose only tools are Web IQ's MCP server (web, news, images, videos,
browse; auto too once the AppID has it). The model comes through agentgateway.

Conversations live in an InMemorySaver, keyed by a thread id the browser keeps: they last until the app restarts
or the user clears them. Web IQ's terms forbid storing results beyond the user's own chat history, so nothing is
written to disk."""

import time
from collections.abc import Awaitable, Callable
from datetime import date
from typing import Any

import openai
from deepagents import create_deep_agent
from langchain.agents.middleware import AgentMiddleware, ModelRequest, ToolCallRequest
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.graph.state import CompiledStateGraph

from .api.errors import ApiError
from .config import Settings
from .webiq import PRICE_PER_1K_USD

# MCP tool name -> REST path, for the list price of each call
TOOL_PATHS = {
    "web": "search/web",
    "news": "search/news",
    "images": "search/images",
    "videos": "search/videos",
    "browse": "browse",
    "auto": "auto",
}

SYSTEM_PROMPT = """You are the assistant in Web IQ Explorer. You find things on the web with Microsoft Web IQ tools
and answer from what they return. Today is {today}.

Pick the tool from what the user asks for:
- videos: "find a video", "show me videos", a tutorial, talk, trailer or clip to watch
- news: "find news", "latest", "what happened", headlines, recent events about a company or topic
- images: "find an image", a picture, photo, logo, or "what does ... look like"
- browse: the user gives a URL, or asks to read, summarize or check one specific page; pass what they want to know
  from that page as `query`
- web: everything else (facts, how-tos, comparisons, prices, opening hours)
Use one tool call when that answers the question; use more only when it needs several kinds of results. Ask for
maxResults 5 and maxLength 1500 unless the user wants more. Set language and region to the user's language and
country when it is clear (Dutch, Belgium: language "nl", region "BE"). Follow-ups ("and videos?", "more recent")
refer to the earlier questions in this conversation.

Answer briefly, in the user's language. Every fact comes from a tool result: cite each source you used as a markdown
link [title](url) next to the claim, and never invent facts or links. Quote at most 200 characters from one source.
The user sees image and video results as cards under your answer, so for those give a short overview, not every link.
If the tools found nothing useful, say so."""


class OnlyTheseTools(AgentMiddleware):
    """Deep Agents always adds file tools, write_todos and a `task` subagent, with prompt text about them. This
    assistant only searches: the model is offered the Web IQ tools and this app's prompt, and any other call is
    refused."""

    def __init__(self, allowed: set[str], system_prompt: Callable[[], str]):
        super().__init__()
        self.allowed, self.system_prompt = allowed, system_prompt

    async def awrap_model_call(self, request: ModelRequest, handler: Callable[[ModelRequest], Awaitable[Any]]) -> Any:
        tools: list[BaseTool | dict[str, Any]] = [
            t for t in request.tools if isinstance(t, BaseTool) and t.name in self.allowed
        ]
        return await handler(request.override(tools=tools, system_message=SystemMessage(self.system_prompt())))

    async def awrap_tool_call(
        self, request: ToolCallRequest, handler: Callable[[ToolCallRequest], Awaitable[Any]]
    ) -> Any:
        call = request.tool_call
        if call["name"] not in self.allowed:
            return ToolMessage(f"Tool {call['name']} is not available.", tool_call_id=call["id"] or "", status="error")
        return await handler(request)


def default_model(settings: Settings) -> BaseChatModel:
    return ChatOpenAI(
        base_url=settings.agent_base_url,
        api_key=settings.agent_api_key,
        model=settings.agent_model,
        # reasoning models take function tools on the Responses API only; store=False keeps nothing at the provider
        use_responses_api=True,
        store=False,
        include=["reasoning.encrypted_content"],
        timeout=settings.agent_timeout_seconds,
        max_retries=1,
    )


def mcp_tools_loader(settings: Settings) -> Callable[[], Awaitable[list[BaseTool]]]:
    """The Web IQ MCP server's tools. It lists only the tools this AppID may call."""
    client = MultiServerMCPClient(
        {
            "webiq": {
                "transport": "streamable_http",
                "url": settings.webiq_base_url.rstrip("/") + "/mcp",
                "headers": {"x-apikey": settings.webiq_api_key},
                "timeout": settings.webiq_timeout_seconds,
            }
        }
    )
    return client.get_tools


class Assistant:
    def __init__(self, model: BaseChatModel, load_tools: Callable[[], Awaitable[list[BaseTool]]]):
        self.model, self.load_tools = model, load_tools
        self.checkpointer = InMemorySaver()
        self._agent: CompiledStateGraph | None = None

    async def agent(self) -> CompiledStateGraph:
        """Built on first use, once the MCP tools are listed: startup doesn't depend on Web IQ being reachable."""
        if self._agent is None:
            try:
                tools = await self.load_tools()
            except Exception as e:  # the MCP client raises transport errors wrapped in exception groups
                raise ApiError("mcp_error", f"Could not list the Web IQ MCP tools: {_cause(e)}", 502) from e
            self._agent = create_deep_agent(
                model=self.model,
                tools=tools,
                middleware=[OnlyTheseTools({t.name for t in tools}, _prompt)],
                checkpointer=self.checkpointer,
                name="webiq-assistant",
            )
        return self._agent

    async def ask(self, thread_id: str, question: str) -> dict[str, Any]:
        """Add a question to the thread, run the agent, and return this turn: answer plus every tool call."""
        agent = await self.agent()
        start = time.perf_counter()
        try:
            state = await agent.ainvoke({"messages": [HumanMessage(question)]}, _config(thread_id))
        except openai.APIError as e:
            raise ApiError("agent_error", f"The model call failed: {e.message}", 502) from e
        except GraphRecursionError as e:
            raise ApiError("agent_error", "The agent took too many steps; ask a narrower question.", 502) from e
        except Exception as e:  # a tool transport failure (MCP) surfaces here, wrapped
            raise ApiError("mcp_error", f"A Web IQ MCP call failed: {_cause(e)}", 502) from e
        turn = _turns(state["messages"])[-1]
        return {**turn, "elapsed_ms": round((time.perf_counter() - start) * 1000)}

    async def history(self, thread_id: str) -> list[dict[str, Any]]:
        if await self.checkpointer.aget_tuple(_config(thread_id)) is None:
            return []
        state = await (await self.agent()).aget_state(_config(thread_id))
        return _turns(state.values.get("messages", []))

    async def clear(self, thread_id: str) -> None:
        await self.checkpointer.adelete_thread(thread_id)

    @property
    def model_name(self) -> str:
        return getattr(self.model, "model_name", None) or type(self.model).__name__


def _prompt() -> str:
    return SYSTEM_PROMPT.format(today=date.today().isoformat())


def _config(thread_id: str) -> RunnableConfig:
    return {"configurable": {"thread_id": thread_id}, "recursion_limit": 16}


def _turns(messages: list[AnyMessage]) -> list[dict[str, Any]]:
    """The thread as turns: each question with the final answer and the tool calls made for it."""
    turns: list[dict[str, Any]] = []
    group: list[AnyMessage] = []
    for m in [*messages, None]:
        if m is None or isinstance(m, HumanMessage):
            if group:
                turns.append(_turn(group))
            group = [m] if m is not None else []
        else:
            group.append(m)
    return turns


def _turn(messages: list[AnyMessage]) -> dict[str, Any]:
    ais = [m for m in messages if isinstance(m, AIMessage)]
    used = [m.usage_metadata for m in ais if m.usage_metadata]
    return {
        "question": messages[0].text,
        "answer": next((m.text for m in reversed(ais) if not m.tool_calls), ""),
        "steps": _steps(messages),
        "input_tokens": sum(u["input_tokens"] for u in used),
        "output_tokens": sum(u["output_tokens"] for u in used),
    }


def _steps(messages: list[AnyMessage]) -> list[dict[str, Any]]:
    results = {m.tool_call_id: m for m in messages if isinstance(m, ToolMessage)}
    steps = []
    for m in messages:
        if not isinstance(m, AIMessage):
            continue
        for call in m.tool_calls:
            res = results.get(call["id"] or "")
            artifact = res.artifact if res is not None else None
            structured = artifact.get("structured_content") if isinstance(artifact, dict) else None
            failed = res is None or res.status == "error"
            name = call["name"]
            steps.append(
                {
                    "tool": name,
                    "args": call["args"],
                    "error": (res.text if res is not None else "no result") if failed else None,
                    "cost_usd": 0.0 if failed else PRICE_PER_1K_USD.get(TOOL_PATHS.get(name, ""), 0.0) / 1000,
                    # typed per tool, so the page can show the same cards as the explorer
                    (name if name in TOOL_PATHS else "other"): structured,
                }
            )
    return steps


def _cause(e: BaseException) -> str:
    """The innermost error of an exception group, which is the one worth showing."""
    while isinstance(e, BaseExceptionGroup) and e.exceptions:
        e = e.exceptions[0]
    return f"{type(e).__name__}: {e}"
