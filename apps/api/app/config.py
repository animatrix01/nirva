from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./nirva-dev.db"
    qdrant_url: str = "http://qdrant:6333"
    model_base_url: str = "http://ollama:11434/v1"
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    storage_path: str = "./storage"

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720


@lru_cache
def get_settings() -> Settings:
    return Settings()
