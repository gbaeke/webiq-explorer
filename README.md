# Web IQ Explorer

A local web app for trying out [Microsoft Web IQ](https://learn.microsoft.com/web-iq/overview), Microsoft's web
search and grounding APIs for LLMs and agents. It has two parts:

- **Explorer:** one page per endpoint (Web, News, Images, Videos, Browse, Auto) with every parameter from the API
  reference. Each call shows the rendered results, the raw JSON response, and the exact request body with a curl
  command, plus the HTTP status, latency, list price and `traceId`.
- **Assistant:** a popup chat agent that uses Web IQ through its **MCP server**, not the REST API. Ask "find a
  video about …", "find news about …", "find an image of …" or "summarize <url>": the agent picks the matching
  Web IQ tool and shows its results as cards under the answer, with the sources cited. It runs on any
  OpenAI-compatible model endpoint.

Your Web IQ API key and model key stay on the server. Nothing is written to disk: results live in the page, and
assistant conversations live in server memory until you clear them or restart the app.

## What you need

- [uv](https://docs.astral.sh/uv/) and [Node.js](https://nodejs.org) 24 or later
- A **paid Azure subscription** for Web IQ. Azure credits and sponsorship subscriptions don't work.
- For the assistant: a model endpoint that speaks the **OpenAI Responses API** with function tools (see
  [Use your own model](#use-your-own-model))

## 1. Create your Web IQ resource and API key

Web IQ is billed through an Azure resource. Your app calls `https://api.microsoft.ai/v3` directly; the resource
is only for metering.

**Azure portal:** search for **Microsoft Web IQ**, select **Create**, pick the subscription and resource group,
accept the [Web IQ Terms of Use](https://www.microsoft.com/en-us/webiq/webiq-legal), and create it.

**Or with the Azure CLI** (bash):

```bash
az account set --subscription <subscription-id>
az provider register --namespace Microsoft.WebIQ --wait
az group create -n rg-webiq -l westeurope
az resource create -g rg-webiq -n <globally-unique-name> \
  --resource-type Microsoft.WebIQ/accounts --api-version 2026-06-01-preview --is-full-object \
  --properties '{"location":"global","kind":"WebIQ.Grounding","sku":{"name":"G3"},"properties":{"statisticsEnabled":false}}'
```

If this fails with "feature not enabled for the subscription", ask your Microsoft contact to enable Web IQ for it.

**Then get a key:**

1. Go to the [Web IQ portal](https://webiq.microsoft.ai), select **Get Started**, and sign in with an account in
   the tenant that owns the subscription. Use a work or school account (`…@<tenant>.onmicrosoft.com` or your
   organization's). In our test, a personal Microsoft account (outlook.com, hotmail.com) signed in but the portal
   then failed with "We couldn't load your account".
2. Connect the subscription and the resource you created. This creates your **Web IQ AppID** (default 15 queries
   per second).
3. In **Profile Management → API Keys**, select **Create API Key** and copy it.

The **Auto** endpoint is in beta and is enabled per AppID on request
([support form](https://aka.ms/webiq-support-form)). Until then it answers 403, and the MCP server doesn't list it.

## 2. Configure

```bash
cp .env.example .env
```

Set at least `WEBIQ_API_KEY` in `.env`. Every setting is documented in `.env.example`. `.env` is git-ignored.

## 3. Run

```bash
scripts/run-local.sh        # builds the frontend and serves everything on http://localhost:8837
```

The API docs are at http://localhost:8837/api/docs. The command-line sample `examples/web_search.py` calls the Web
Search API without the app: `uv run examples/web_search.py "your query"`.

## Use your own model

The assistant uses LangChain's `ChatOpenAI` on the **Responses API** (`use_responses_api=True`, `store=False`), so
any endpoint that implements `/v1/responses` with function calling works. Set three values in `.env`:

| Setting | What it is |
|---|---|
| `AGENT_BASE_URL` | the endpoint's base URL, ending in `/v1` |
| `AGENT_MODEL` | the model name, or the deployment name on Azure |
| `AGENT_API_KEY` | the endpoint's key |

**Azure AI Foundry** (Azure OpenAI v1 endpoint, no `api-version` needed):

```bash
AGENT_BASE_URL=https://<your-resource>.openai.azure.com/openai/v1/
AGENT_MODEL=<your-deployment-name>
AGENT_API_KEY=<your-key>
```

**OpenAI:**

```bash
AGENT_BASE_URL=https://api.openai.com/v1
AGENT_MODEL=<a model name>
AGENT_API_KEY=<your-key>
```

**A local gateway such as [agentgateway](https://agentgateway.dev)** (the default): run the gateway with an LLM
route that exposes the OpenAI-compatible API, and point the app at it. The gateway holds the real provider keys,
so the app's key can be any placeholder:

```bash
AGENT_BASE_URL=http://localhost:4000/v1
AGENT_MODEL=<a model name the gateway exposes>   # see: curl http://localhost:4000/v1/models
AGENT_API_KEY=not-needed
```

A small, cheap model is enough: the agent mostly picks one tool and summarizes its results. Without a reachable
model, the explorer pages still work and only the assistant fails, with the model's error.

## What it costs

Web IQ is pay-per-call ([pricing](https://learn.microsoft.com/web-iq/resources/pricing)): Web, News, Images and Videos
cost $7 per 1,000 calls, Browse $1 per 1,000, and Auto is free while in beta. The header shows the number of calls
made from the tab and their list price. Every assistant tool call is a Web IQ call too, plus the model's tokens
(shown under each answer). A follow-up question resends the conversation so far, including earlier results, so its
input tokens grow with every turn. Clear the conversation (trash icon) to start small again.

## Web IQ terms worth knowing

The [Terms of Use](https://www.microsoft.com/en-us/webiq/webiq-legal) apply to anything you build on this. In short:
show citations next to any answer you show users, show at most 200 characters from one source, don't store or cache
results (beyond a user's own chat history and your internal work product), and don't use the images or videos
themselves for grounding, only their metadata.

## How it works

- `src/webiq_explorer/webiq.py`: the REST client. It forwards each page's request to Web IQ unchanged, with the key.
- `src/webiq_explorer/api/webiq.py` and `webiq_models.py`: one route per endpoint, with request and response models
  that mirror the API reference (camelCase on the wire, extra response fields passed through).
- `src/webiq_explorer/agent.py`: the assistant, a [Deep Agent](https://github.com/langchain-ai/deepagents) with an
  `InMemorySaver` for conversations. Its tools come from the Web IQ MCP server (`https://api.microsoft.ai/v3/mcp`)
  through `langchain-mcp-adapters`. A small middleware offers the model only those tools and the app's own prompt,
  which maps requests ("find a video", "find news", …) to tools.
- `frontend/`: React + Vite + TanStack Query. The API client in `frontend/src/client/` is generated from the
  backend's OpenAPI schema.

## Develop

```bash
scripts/run-local.sh --dev  # Vite with hot reload on http://localhost:5173
scripts/check.sh            # ruff, pyright, pytest, API client up to date, prettier, oxlint, build: what CI runs
```

Tests never call Web IQ or a model: they use a fake Web IQ (`httpx2.MockTransport`) and a scripted chat model with
fake MCP tools.
