from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.extract import ExtractRequest, ExtractResponse
from app.services.crawl.crawl4ai_service import (
    Crawl4AIExtractor,
    ExtractionFailedError,
    ExtractorNotConfiguredError,
)

router = APIRouter(prefix="/extract", tags=["extract"])


def get_extractor() -> Crawl4AIExtractor:
    return Crawl4AIExtractor()


@router.post("", response_model=ExtractResponse)
async def extract_content(
    payload: ExtractRequest,
    extractor: Crawl4AIExtractor = Depends(get_extractor),
) -> ExtractResponse:
    try:
        result = await extractor.extract(payload)
    except ExtractionFailedError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except ExtractorNotConfiguredError as error:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(error),
        ) from error

    return ExtractResponse.model_validate(result)
