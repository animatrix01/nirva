import { NextResponse } from "next/server";

/**
 * POST /api/translate — Hindi translation via the LOCAL model gateway.
 *
 * Body: { text: string (≤2000 chars), targetLang: "hi" }
 * Uses the frozen COMMON.md contract var MODEL_BASE_URL (Ollama dev /
 * vLLM prod) — no cloud calls, no keys. Fails with 502 when the gateway
 * is unreachable so the UI degrades honestly.
 */

const MAX_CHARS = 2000;
const TIMEOUT_MS = 30000;

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const text =
    typeof body === "object" && body !== null && "text" in body
      ? String((body as { text: unknown }).text ?? "").trim()
      : "";
  const targetLang =
    typeof body === "object" && body !== null && "targetLang" in body
      ? String((body as { targetLang: unknown }).targetLang ?? "")
      : "";
  if (!text || targetLang !== "hi") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const baseUrl =
    process.env.MODEL_BASE_URL ?? "http://localhost:11434/v1";
  const model =
    process.env.MODEL_TEXT_MODEL ?? "qwen2.5:3b-instruct-q4_K_M";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Translate the following equipment-failure investigation summary into natural spoken Hindi. " +
              "Keep equipment IDs (e.g. P-204), work-order IDs, numbers, units and revision codes exactly as-is. " +
              "Reply with only the Hindi translation, no explanations.",
          },
          { role: "user", content: text.slice(0, MAX_CHARS) },
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
          ).trim()
        : "";
    if (!content) {
      return NextResponse.json({ error: "empty_result" }, { status: 502 });
    }
    return NextResponse.json({ text: content });
  } catch {
    return NextResponse.json({ error: "model_unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
