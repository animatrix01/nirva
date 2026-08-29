"""Raw-call verification: qwen2.5-vl image inspection through local Ollama.

Tests the OpenAI-compatible /v1 image message format BEFORE any wiring, with
fallback probe of the native /api/chat images format.
"""

import base64
import sys

import httpx

BASE = "http://127.0.0.1:11434"
MODEL = "qwen2.5vl:3b"
PROMPT = (
    "Describe ONLY what you observe in this equipment photo: leaks, wear, "
    "alignment, corrosion, gauge readings. Do not conclude causes or "
    "recommend actions. Be specific and brief."
)

image_b64 = base64.b64encode(open("data/synthetic/P204_photo.jpg", "rb").read()).decode()

openai_body = {
    "model": MODEL,
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                },
            ],
        }
    ],
    "stream": False,
    "temperature": 0.0,
    "max_tokens": 400,
}

print("=== Attempt 1: OpenAI-compatible /v1 chat/completions ===")
try:
    r = httpx.post(f"{BASE}/v1/chat/completions", json=openai_body, timeout=180.0)
    print("status:", r.status_code)
    if r.status_code == 200:
        print("content:", r.json()["choices"][0]["message"]["content"][:500])
        sys.exit(0)
    print("body:", r.text[:300])
except Exception as exc:
    print("failed:", exc)

print("\n=== Attempt 2: native /api/chat with images ===")
native_body = {
    "model": MODEL,
    "messages": [{"role": "user", "content": PROMPT, "images": [image_b64]}],
    "stream": False,
    "options": {"temperature": 0.0, "num_predict": 400},
}
r = httpx.post(f"{BASE}/api/chat", json=native_body, timeout=180.0)
print("status:", r.status_code)
if r.status_code == 200:
    print("content:", r.json()["message"]["content"][:500])
else:
    print("body:", r.text[:300])
