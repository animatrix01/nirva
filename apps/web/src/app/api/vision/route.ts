import { NextResponse } from "next/server";
import { splitObservations } from "@/lib/vision-observations";

/**
 * POST /api/vision — equipment-photo inspection via the LOCAL vision model.
 *
 * Body: { image: string (image/* data URL, ≤15MB) }
 * Mirrors `packages/agent/src/nirva_agent/vision.py`: observations-only
 * prompt against MODEL_BASE_URL (Ollama dev / vLLM prod). No cloud calls.
 * Gateway down → 502 so the UI shows the honest offline fallback.
 */

const TIMEOUT_MS = 120_000;
const MAX_DATA_URL_CHARS = 15_000_000;

const OBSERVATIONS_PROMPT =
  "Describe ONLY what you observe in this equipment photo: leaks, wear, " +
  "alignment, corrosion, gauge readings. Do not conclude causes or " +
  "recommend actions. Be specific and brief. One observation per line.";

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const image =
    typeof body === "object" && body !== null && "image" in body
      ? String((body as { image: unknown }).image ?? "")
      : "";
  if (
    !image.startsWith("data:image/") ||
    image.length > MAX_DATA_URL_CHARS
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const baseUrl = process.env.MODEL_BASE_URL ?? "http://localhost:11434/v1";
  const model = process.env.MODEL_VISION_MODEL ?? "qwen2.5vl:3b";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 400,
        stream: false,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OBSERVATIONS_PROMPT },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "model_unavailable" }, { status: 502 });
    }
    const data: unknown = await res.json().catch(() => null);
    const content =
      typeof data === "object" &&
      data !== null &&
      "choices" in data &&
      Array.isArray((data as { choices: unknown }).choices)
        ? String(
            (data as { choices: Array<{ message?: { content?: unknown } }> })
              .choices[0]?.message?.content ?? "",
          )
        : "";
    const observations = splitObservations(content);
    if (observations.length === 0) {
      return NextResponse.json({ error: "empty_result" }, { status: 502 });
    }
    return NextResponse.json({ observations });
  } catch {
    return NextResponse.json({ error: "model_unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
