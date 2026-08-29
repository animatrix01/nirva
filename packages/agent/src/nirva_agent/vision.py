"""Vision-language inspection helper (observations only).

Calls the local OpenAI-compatible endpoint with an image message. The prompt
MUST be observations-only: the vision model records what is visible (leaks,
wear, alignment, corrosion, gauge readings) and is instructed never to
conclude causes or recommend actions — observations enter evidence like any
other source, and humans make the call.
"""

from __future__ import annotations

import base64

import httpx

from nirva_agent.gateway import GatewayError

__all__ = ["describe_image"]

VLM_OBSERVATIONS_PROMPT = (
    "Describe ONLY what you observe in this equipment photo: leaks, wear, "
    "alignment, corrosion, gauge readings. Do not conclude causes or "
    "recommend actions. Be specific and brief."
)


def describe_image(
    base_url: str,
    model: str,
    prompt: str,
    image_bytes: bytes,
    *,
    image_format: str = "jpeg",
    timeout: float = 180.0,
) -> str:
    """One-shot vision inspection against the local OpenAI-compatible server."""
    data_url = f"data:image/{image_format};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    body = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "stream": False,
        "temperature": 0.0,
        "max_tokens": 400,
    }
    try:
        response = httpx.post(
            f"{base_url.rstrip('/')}/chat/completions", json=body, timeout=timeout
        )
    except httpx.HTTPError as exc:
        raise GatewayError(
            f"vision gateway unreachable at {base_url}: {exc}"
        ) from exc
    if response.status_code >= 400:
        raise GatewayError(
            f"vision gateway returned HTTP {response.status_code}: {response.text[:300]}"
        )
    payload = response.json()
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise GatewayError("vision response missing choices")
    message = choices[0].get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str):
        raise GatewayError("vision response missing message.content")
    return content.strip()
