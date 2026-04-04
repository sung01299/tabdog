from __future__ import annotations

import argparse
import asyncio
import json

from app.services.chat.chat_service import ChatService


async def main() -> None:
    parser = argparse.ArgumentParser(description="Run a local backend chat test without HTTP.")
    parser.add_argument("--document-id", action="append", required=True, dest="document_ids")
    parser.add_argument("--question", required=True)
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--model", default="gemini-2.5-flash")
    parser.add_argument("--max-chunks", type=int, default=10)
    args = parser.parse_args()

    service = ChatService()
    result = await service.ask(
        question=args.question,
        document_ids=args.document_ids,
        api_key=args.api_key,
        model=args.model,
        max_chunks=args.max_chunks,
    )
    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
