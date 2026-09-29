/**
 * parseFindingsText
 *
 * Parses the markdown-formatted findings string produced by the investigation
 * engine (nirva_agent/graph.py → FinalReport.findings) into structured sections
 * for display in the completed investigation UI.
 *
 * The backend produces findings in this shape:
 *   ## Root Cause Analysis — [title]
 *
 *   **Primary finding:** [sentence(s)]
 *
 *   **Supporting evidence:**
 *   - [bullet 1]
 *   - [bullet 2]
 *
 *   **Contradiction detected:** [sentence(s)]
 *
 *   **Recommended action:** [sentence(s)]
 *
 * None of these sections is guaranteed to be present. The parser degrades
 * gracefully — anything it cannot classify is placed in `remainder` for
 * fallback rendering.
 */

export interface ParsedFindings {
  /** Overall title, e.g. "Root Cause Analysis — Pump P-204" (without ##) */
  title: string | null;
  /** The primary conclusion sentence(s). */
  primaryFinding: string | null;
  /** Bullet evidence lines (stripped of leading dash/bullet). */
  supportingEvidence: string[];
  /** Contradiction sentence(s) if detected. */
  contradiction: string | null;
  /** Recommended action sentence(s). */
  recommendedAction: string | null;
  /**
   * Any remaining text that did not match a known section.
   * Rendered verbatim as a fallback so nothing is lost.
   */
  remainder: string;
}

export function parseFindingsText(raw: string): ParsedFindings {
  const result: ParsedFindings = {
    title: null,
    primaryFinding: null,
    supportingEvidence: [],
    contradiction: null,
    recommendedAction: null,
    remainder: "",
  };

  if (!raw?.trim()) return result;

  const lines = raw.split("\n");
  const unmatched: string[] = [];

  // State machine: track which multi-line section we're inside
  type Section = "none" | "evidence" | "remainder";
  let currentSection: Section = "none";
  const evidenceBuf: string[] = [];
  const remainderBuf: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // ── H2 title ──────────────────────────────────────────────────────
    if (line.startsWith("## ")) {
      result.title = line.slice(3).trim();
      currentSection = "none";
      continue;
    }

    // ── H3 or H1 (treat as secondary title / ignore) ──────────────────
    if (line.startsWith("#")) {
      currentSection = "none";
      continue;
    }

    // ── **Primary finding:** ──────────────────────────────────────────
    const pfMatch = line.match(/^\*{1,2}Primary finding:\*{0,2}\s*(.*)/i);
    if (pfMatch) {
      result.primaryFinding = (pfMatch[1] ?? "").trim() || null;
      currentSection = "none";
      continue;
    }

    // ── **Supporting evidence:** (starts a bullet section) ───────────
    if (/^\*{1,2}Supporting evidence:\*{0,2}\s*$/i.test(line)) {
      currentSection = "evidence";
      continue;
    }

    // ── **Contradiction detected:** ───────────────────────────────────
    const cdMatch = line.match(/^\*{1,2}Contradiction detected:\*{0,2}\s*(.*)/i);
    if (cdMatch) {
      result.contradiction = (cdMatch[1] ?? "").trim() || null;
      currentSection = "none";
      continue;
    }

    // ── **Recommended action:** ───────────────────────────────────────
    const raMatch = line.match(/^\*{1,2}Recommended action:\*{0,2}\s*(.*)/i);
    if (raMatch) {
      result.recommendedAction = (raMatch[1] ?? "").trim() || null;
      currentSection = "none";
      continue;
    }

    // ── Bullet lines (while inside evidence section) ──────────────────
    if (currentSection === "evidence") {
      const bullet = line.match(/^[-*•]\s+(.*)/);
      if (bullet) {
        evidenceBuf.push(stripInlineChunkRef(bullet[1].trim()));
        continue;
      }
      // Blank line inside evidence → stay in section
      if (line.trim() === "") continue;
      // Non-bullet, non-blank → exit evidence section
      currentSection = "none";
    }

    // ── Blank lines → skip ────────────────────────────────────────────
    if (line.trim() === "") continue;

    // ── Anything else → remainder ─────────────────────────────────────
    remainderBuf.push(line);
  }

  result.supportingEvidence = evidenceBuf;
  result.remainder = remainderBuf
    .join("\n")
    .replace(/\*\*/g, "") // strip leftover bold markers
    .trim();

  return result;
}

/**
 * Remove internal [chunk_id=...] references from evidence bullet text.
 * These are implementation details not relevant to the engineer-facing report.
 */
function stripInlineChunkRef(text: string): string {
  return text.replace(/\s*\[chunk_id=[^\]]+\]/gi, "").trim();
}
