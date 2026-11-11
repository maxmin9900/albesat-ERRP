"""Structured logging configuration."""

import logging
import sys

from src.core.config import get_settings


def setup_logging() -> None:
    settings = get_settings()
    level = logging.DEBUG if settings.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stdout,
        force=True,
    )
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
