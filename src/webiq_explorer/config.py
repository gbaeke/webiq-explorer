from functools import lru_cache
from typing import Any

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Every setting the app reads, from the environment or .env. .env.example lists them all (a test checks)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8837

    webiq_api_key: str = ""  # from the Web IQ portal (Profile Management > API Keys); never sent to the browser
    webiq_base_url: str = "https://api.microsoft.ai/v3"
    webiq_timeout_seconds: float = 60  # Browse with a live crawl can take a while

    # the assistant: any OpenAI-compatible endpoint with the Responses API; locally the agentgateway on :4000
    agent_base_url: str = "http://localhost:4000/v1"
    agent_model: str = "azure-gpt-6-luna"  # the cheap one: $0.10 / $0.50 per 1M tokens in and out
    agent_api_key: SecretStr = SecretStr("not-needed")  # agentgateway holds the real model keys
    agent_timeout_seconds: float = 60

    @property
    def agent_configured(self) -> bool:
        return bool(self.webiq_api_key and self.agent_base_url and self.agent_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def settings_without_env_file(**values: Any) -> Settings:
    """Settings from these values and the environment only: .env is not read (tests, tools)."""
    return Settings(_env_file=None, **values)  # pyright: ignore[reportCallIssue]  (pydantic-settings' init option)
