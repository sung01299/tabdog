from fastapi import APIRouter, Depends, HTTPException, status
import logging

from app.schemas.chat import ChatAskRequest, ChatAskResponse
from app.services.chat.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


def get_chat_service() -> ChatService:
    return ChatService()


@router.post("/ask", response_model=ChatAskResponse)
async def ask_question(
    payload: ChatAskRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatAskResponse:
    if not payload.api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="api_key is required for the local backend chat flow.",
        )

    try:
        return await chat_service.ask(
            question=payload.question,
            document_ids=payload.document_ids,
            api_key=payload.api_key,
            model=payload.model,
            max_chunks=payload.max_chunks,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error
    except Exception as error:  # noqa: BLE001
        logger.exception("Unexpected backend chat error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error),
        ) from error
