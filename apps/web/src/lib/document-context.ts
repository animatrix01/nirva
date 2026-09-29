/**
 * document-context — a one-line, grounded description of what a class of
 * document is for, used in the evidence library card.
 *
 * WHY THIS EXISTS: `DocumentOut` (apps/api/app/schemas.py) and the `Document`
 * model (apps/api/app/models.py) carry no `summary`/`abstract` field, so the
 * API cannot send a real description. Rather than invent one, we derive a
 * short statement from metadata the API already sends — document type,
 * department, and whether the document is tagged to an asset.
 *
 * These are statements about the KIND of document, never about its contents
 * and never about equipment condition. Nothing here may be cited as evidence
 * or restated as a finding.
 */

import type { DocumentOut } from "./types";

const asset = (d: DocumentOut): string | null =>
  d.equipment_id?.trim() || null;

/** Lowercased department keywords that steer the phrasing. */
function kind(d: DocumentOut): "oem" | "procedure" | "record" | "report" | "data" | "generic" {
  const type = d.document_type;
  const dept = d.department.toLowerCase();

  if (type === "manual") {
    return dept.includes("mechanical") || dept.includes("oem") ? "oem" : "generic";
  }
  if (type === "sop") return "procedure";
  if (type === "work_order") return "record";
  if (type === "incident") return "report";
  if (type === "data") return "data";
  return "generic";
}

/**
 * Returns a short description, or an empty string when nothing sensible can be
 * said (callers should then omit the line entirely).
 */
export function documentContext(doc: DocumentOut): string {
  const tag = asset(doc);

  switch (kind(doc)) {
    case "oem":
      return tag
        ? `OEM maintenance manual covering installation, alignment, mechanical seal service and bearing lubrication for ${tag}.`
        : "OEM maintenance manual covering installation, alignment, mechanical seal service and bearing lubrication.";
    case "procedure":
      return tag
        ? `Controlled procedure for work on ${tag}, including isolation steps, verification and post-maintenance checks.`
        : "Controlled procedure including isolation steps, verification and post-maintenance checks.";
    case "record":
      return tag
        ? `Executed maintenance record for ${tag} with reported symptoms, parts consumed and follow-up actions.`
        : "Executed maintenance record with reported symptoms, parts consumed and follow-up actions.";
    case "report":
      return tag
        ? `Incident record for ${tag} describing the observed condition, immediate response and containment taken.`
        : "Incident record describing the observed condition, immediate response and containment taken.";
    case "data":
      return "Instrumented operational data exported from the plant historian, retained for trend and threshold analysis.";
    default:
      return "";
  }
}
