from fastapi import FastAPI

from app.api.routes import chat
from app.api.routes import extract, health
from app.core.config import get_settings
from app.core.logging import configure_logging


configure_logging()
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(health.router)
app.include_router(extract.router)
app.include_router(chat.router)
