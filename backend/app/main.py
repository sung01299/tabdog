from fastapi import FastAPI

from app.api.routes import chat
from app.api.routes import extract, health
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.chat.chat_service import warmup_chat_runtime


configure_logging()
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.on_event("startup")
async def startup_event() -> None:
    await warmup_chat_runtime()

app.include_router(health.router)
app.include_router(extract.router)
app.include_router(chat.router)
