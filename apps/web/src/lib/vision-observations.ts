/**
 * vision-observations — split raw VLM inspection text into display bullets.
 *
 * The vision model is prompted observations-only (see
 * `app/api/vision/route.ts`, mirroring `packages/agent/.../vision.py`):
 * visible conditions, never causes or actions.
 */

/** Split model output into clean bullets; drop numbering/markers/empties. */
export function splitObservations(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length > 1);
}
