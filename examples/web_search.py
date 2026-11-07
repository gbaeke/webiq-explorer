# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27", "python-dotenv>=1.0"]
# ///
"""Call the Microsoft Web IQ Web Search API.

Usage:
    # put WEBIQ_API_KEY=<your key from https://webiq.microsoft.ai/profiles> in .env
    uv run examples/web_search.py "latest Azure AI announcements" --max-results 5 --region BE
"""

import argparse
import os
import sys

import httpx
from dotenv import load_dotenv

ENDPOINT = "https://api.microsoft.ai/v3/search/web"


def web_search(
    query: str,
    api_key: str,
    *,
    max_results: int = 10,
    language: str = "en",
    region: str = "US",
    max_length: int = 3000,
    safe_search: str = "strict",
) -> dict:
    """Run one Web IQ web search and return the parsed JSON response."""
    payload = {
        "query": query,
        "maxResults": max_results,
        "language": language,
        "region": region,
        "maxLength": max_length,
        "contentFormat": "passage",  # best format for LLM grounding
        "safeSearch": safe_search,
    }
    headers = {"x-apikey": api_key, "content-type": "application/json"}

    response = httpx.post(ENDPOINT, json=payload, headers=headers, timeout=30)
    if response.status_code == 429:
        raise RuntimeError("Rate limit exceeded (default 15 QPS per AppID); retry later.")
    response.raise_for_status()
    return response.json()


def main() -> int:
    parser = argparse.ArgumentParser(description="Search the web with Microsoft Web IQ.")
    parser.add_argument("query", help="Search query (max 1000 chars; supports site: and -site:)")
    parser.add_argument("--max-results", type=int, default=10, help="1-50, default 10")
    parser.add_argument("--language", default="en", help="ISO 639-1 code, e.g. en, nl")
    parser.add_argument("--region", default="US", help="2-letter region code, e.g. US, BE")
    parser.add_argument("--max-length", type=int, default=3000, help="Max chars of content per result")
    args = parser.parse_args()

    load_dotenv()  # reads .env from the current directory, if present
    api_key = os.environ.get("WEBIQ_API_KEY")
    if not api_key:
        print("Set WEBIQ_API_KEY in .env or the environment.", file=sys.stderr)
        return 1

    try:
        data = web_search(
            args.query,
            api_key,
            max_results=args.max_results,
            language=args.language,
            region=args.region,
            max_length=args.max_length,
        )
    except httpx.HTTPStatusError as e:
        print(f"HTTP {e.response.status_code}: {e.response.text}", file=sys.stderr)
        return 1
    except (httpx.HTTPError, RuntimeError) as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 1

    results = data.get("webResults", [])
    print(f"{len(results)} results (riskLevel={data.get('riskLevel')}, traceId={data.get('traceId')})\n")
    for i, r in enumerate(results, 1):
        print(f"[{i}] {r.get('title')}")
        print(f"    {r.get('url')}")
        if r.get("lastUpdatedAt"):
            print(f"    updated: {r['lastUpdatedAt']}")
        content = (r.get("content") or "").replace("\n", " ")
        print(f"    {content[:300]}{'…' if len(content) > 300 else ''}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
