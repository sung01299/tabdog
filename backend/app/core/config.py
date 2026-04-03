from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"


class Settings(BaseSettings):
    app_name: str = "TabDog Chat Backend"
    app_version: str = "0.1.0"
    environment: str = "local"
    log_level: str = "INFO"
    host: str = "127.0.0.1"
    port: int = 8011

    data_dir: Path = Field(default=DATA_DIR)
    raw_dir: Path = Field(default=DATA_DIR / "raw")
    processed_dir: Path = Field(default=DATA_DIR / "processed")
    sqlite_path: Path = Field(default=DATA_DIR / "metadata.sqlite3")
    crawl4ai_base_dir: Path = Field(default=DATA_DIR / "crawl4ai")

    model_config = SettingsConfigDict(
        env_prefix="TABDOG_BACKEND_",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.raw_dir.mkdir(parents=True, exist_ok=True)
    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    settings.crawl4ai_base_dir.mkdir(parents=True, exist_ok=True)
    return settings
