"""Local embeddings: dense via the MODEL_BASE_URL gateway (bge-m3 on Ollama),
sparse BM25-style token weights computed in-process. No cloud calls.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from typing import Any

import httpx

__all__ = ["EMBED_MODEL", "dense_embeddings", "sparse_embedding"]

EMBED_MODEL = "bge-m3"
_SPARSE_DIM = 100_000
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def dense_embeddings(texts: list[str], *, base_url: str, model: str = EMBED_MODEL) -> list[list[float]]:
    """Batch dense embeddings via the local OpenAI-compatible /embeddings route."""
    if not texts:
        return []
    response = httpx.post(
        f"{base_url.rstrip('/')}/embeddings",
        json={"model": model, "input": texts},
        timeout=120.0,
    )
    response.raise_for_status()
    payload: Any = response.json()
    data = payload.get("data")
    if not isinstance(data, list) or len(data) != len(texts):
        msg = "embeddings response missing data entries"
        raise ValueError(msg)
    ordered = sorted(data, key=lambda item: item.get("index", 0))
    return [list(item["embedding"]) for item in ordered]


def sparse_embedding(text: str) -> dict[int, float]:
    """BM25-lite term weights over a hashed token space (Qdrant sparse vector)."""
    tokens = _tokenize(text)
    counts = Counter(tokens)
    weights: dict[int, float] = {}
    for token, count in counts.items():
        index = int.from_bytes(hashlib.sha1(token.encode("utf-8")).digest()[:4], "big") % _SPARSE_DIM
        weights[index] = weights.get(index, 0.0) + 1.0 + math.log(count)
    return weights
