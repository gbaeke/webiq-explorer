import json

import httpx2
import pytest
from fastapi.testclient import TestClient

from webiq_explorer.api.app import create_app
from webiq_explorer.config import settings_without_env_file


class FakeWebIQ:
    """Stands in for api.microsoft.ai: records each request and answers with the next queued response."""

    def __init__(self):
        self.requests: list[httpx2.Request] = []
        self.status, self.body = 200, {}

    def reply(self, status: int, body: dict) -> None:
        self.status, self.body = status, body

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        return httpx2.Response(self.status, json=self.body)


@pytest.fixture
def fake() -> FakeWebIQ:
    return FakeWebIQ()


@pytest.fixture
def client(fake):
    settings = settings_without_env_file(webiq_api_key="test-key")
    with TestClient(create_app(settings, webiq_transport=httpx2.MockTransport(fake))) as c:
        yield c


def test_web_search_forwards_the_request_with_the_key_and_wraps_the_response(client, fake):
    fake.reply(200, {"webResults": [{"title": "T", "url": "https://x.test", "newField": 1}], "traceId": "t1"})

    res = client.post("/api/webiq/web", json={"query": "azure", "maxResults": 3})

    assert res.status_code == 200
    sent = fake.requests[0]
    assert str(sent.url) == "https://api.microsoft.ai/v3/search/web"
    assert sent.headers["x-apikey"] == "test-key"
    assert json.loads(sent.content)["maxResults"] == 3
    call = res.json()
    assert call["endpoint"] == "search/web"
    assert call["costUsd"] == 0.007
    assert call["request"]["contentFormat"] == "passage"  # defaults are sent explicitly, so the request is visible
    assert call["response"]["webResults"][0] == {"title": "T", "url": "https://x.test", "newField": 1}
    assert call["response"]["traceId"] == "t1"


@pytest.mark.parametrize(
    ("route", "path", "body"),
    [
        ("news", "search/news", {"query": "q"}),
        ("images", "search/images", {"query": "q", "aspectRatio": "wide"}),
        ("videos", "search/videos", {"query": "q", "embeddable": ["player"]}),
        ("browse", "browse", {"url": "https://example.com", "query": "q"}),
        ("auto", "auto", {"query": "q", "responseFilter": ["web", "weather"]}),
    ],
)
def test_every_endpoint_reaches_its_web_iq_path(client, fake, route, path, body):
    res = client.post(f"/api/webiq/{route}", json=body)

    assert res.status_code == 200, res.text
    assert fake.requests[0].url.path == f"/v3/{path}"


def test_unset_options_are_not_sent(client, fake):
    client.post("/api/webiq/images", json={"query": "q"})

    sent = json.loads(fake.requests[0].content)
    assert "aspectRatio" not in sent
    assert "minWidth" not in sent


def test_a_pending_live_crawl_is_returned_without_cost(client, fake):
    fake.reply(202, {"url": "https://example.com", "retryAfter": "2026-11-07T12:00:00Z"})

    call = client.post("/api/webiq/browse", json={"url": "https://example.com", "query": "q"}).json()

    assert call["status"] == 202
    assert call["costUsd"] == 0
    assert call["response"]["retryAfter"] == "2026-11-07T12:00:00Z"


def test_web_iq_errors_keep_their_code_message_and_body(client, fake):
    fake.reply(403, {"errorCode": "AuthUnauthorizedService", "userMessage": "Not enabled.", "traceId": "t2"})

    res = client.post("/api/webiq/auto", json={"query": "q"})

    assert res.status_code == 403
    error = res.json()["error"]
    assert error["code"] == "AuthUnauthorizedService"
    assert error["message"] == "Not enabled."
    assert error["upstreamStatus"] == 403
    assert error["upstream"]["traceId"] == "t2"


def test_web_iq_server_errors_are_a_bad_gateway(client, fake):
    fake.reply(524, {"errorCode": "HostCrawlTimeout", "userMessage": "Timed out."})

    res = client.post("/api/webiq/browse", json={"url": "https://example.com", "query": "q"})

    assert res.status_code == 502
    assert res.json()["error"]["upstreamStatus"] == 524


def test_invalid_parameters_are_rejected_before_calling_web_iq(client, fake):
    res = client.post("/api/webiq/news", json={"query": "q", "maxResults": 21})

    assert res.status_code == 422
    assert fake.requests == []


def test_without_a_key_calls_fail_clearly_and_status_says_so(fake):
    app = create_app(settings_without_env_file(), webiq_transport=httpx2.MockTransport(fake))
    with TestClient(app) as c:
        assert c.get("/api/webiq/status").json()["configured"] is False
        res = c.post("/api/webiq/web", json={"query": "q"})

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "not_configured"
    assert fake.requests == []
