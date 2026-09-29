"use client";

/**
 * New Investigation — compact initiation form.
 *
 * Fields:
 *   01  Investigation objective (textarea, reasonable height)
 *   02  Equipment ID (optional text input)
 *   03  Issue / asset image (optional file attachment with preview)
 *
 * On submit:
 *   1. POST /api/jobs  → creates the job, returns job_id
 *   2. If an image was selected: POST /api/jobs/{id}/image
 *   3. Navigate to /investigations/{job_id}
 *
 * The image upload is best-effort — a failure shows a warning but still
 * navigates to the created investigation so the run isn't lost.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/app-shell";
import { BackTo } from "@/components/back-to";
import { ApiError, createJob, uploadJobImage } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_OBJECTIVE = 8;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateObjective(objective: string): string | null {
  if (objective.trim().length < MIN_OBJECTIVE) {
    return `Objective must be at least ${MIN_OBJECTIVE} characters.`;
  }
  return null;
}

function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return "Unsupported file type. Please attach a JPEG, PNG, WebP, or GIF image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image is too large. Maximum size is 10 MB.";
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewInvestigationPage() {
  const router = useRouter();

  const [objective, setObjective]         = useState("");
  const [equipmentId, setEquipmentId]     = useState("");
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null);

  const [objectiveError, setObjectiveError] = useState<string | null>(null);
  const [imageError, setImageError]         = useState<string | null>(null);
  const [serverError, setServerError]       = useState<string | null>(null);
  const [imageWarnMsg, setImageWarnMsg]     = useState<string | null>(null);
  const [submitting, setSubmitting]         = useState(false);

  // ── Image selection ────────────────────────────────────────────────────────
  function handleImageSelect(file: File) {
    const err = validateImage(file);
    setImageError(err);
    if (err) return;

    // Revoke previous object URL to avoid memory leak
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleImageRemove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl(null);
    setImageError(null);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setImageWarnMsg(null);

    const objErr = validateObjective(objective);
    setObjectiveError(objErr);
    if (objErr) return;
    if (imageError) return;

    setSubmitting(true);
    try {
      // 1. Create the job
      const job = await createJob(
        objective.trim(),
        equipmentId.trim() || null
      );

      // 2. Upload image if attached (best-effort — don't block navigation)
      if (imageFile) {
        try {
          await uploadJobImage(job.job_id, imageFile);
        } catch (imgErr: unknown) {
          // Non-fatal: warn but still navigate to the created investigation
          const msg =
            imgErr instanceof ApiError
              ? imgErr.body.detail
              : "Image upload failed — investigation was created without the image.";
          setImageWarnMsg(msg);
          // Brief pause so the warning is visible before redirect
          await new Promise((r) => setTimeout(r, 1800));
        }
      }

      // 3. Navigate to the running investigation
      router.push(`/investigations/${job.job_id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(
          err.body.field
            ? `${err.body.field}: ${err.body.detail}`
            : err.body.detail
        );
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("Failed to create investigation.");
      }
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppShell title="">
      <div className="mb-4">
        <BackTo href="/investigations" />
      </div>

      {/* Page title */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">New Investigation</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
          Describe the equipment issue in plain language. NIRVA will retrieve relevant
          plant evidence and build an evidence-backed finding.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="flex flex-col gap-0 w-full">

          {/* ── 01 INVESTIGATION OBJECTIVE ── */}
          {/* Two columns inside, flush — textarea left, tips right, zero gap between */}
          <div className="rounded-t-xl border border-stone-200 bg-white overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] divide-y lg:divide-y-0 lg:divide-x divide-stone-200">

              {/* Left: textarea */}
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold text-stone-600 shrink-0">01</span>
                  <Label htmlFor="objective" className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
                    Investigation Objective
                  </Label>
                </div>
                <textarea
                  id="objective"
                  rows={8}
                  className={cn(
                    "w-full flex-1 rounded-lg border bg-white px-4 py-3 text-sm leading-relaxed text-stone-900 outline-none resize-none transition",
                    "placeholder:text-stone-400",
                    objectiveError
                      ? "border-red-300 focus:border-red-400"
                      : "border-stone-300 focus:border-stone-400"
                  )}
                  placeholder="e.g. Investigate why Pump P-204 has failed repeatedly. Compare maintenance history with the OEM manual and safety SOP, check spare-part availability, and prepare a cited maintenance recommendation."
                  value={objective}
                  onChange={(e) => {
                    setObjective(e.target.value);
                    if (objectiveError) setObjectiveError(validateObjective(e.target.value));
                  }}
                  disabled={submitting}
                  required
                />
                {objectiveError ? (
                  <p role="alert" className="text-xs text-red-600">{objectiveError}</p>
                ) : (
                  <p className="text-[11px] text-stone-500">
                    Be specific — include the equipment name, symptom, and what you need to know.
                  </p>
                )}
              </div>

              {/* Right: writing tips — flush, no gap */}
              <div className="p-6 flex flex-col gap-3 bg-stone-50">
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
                  Write a strong objective
                </p>
                <ul className="flex flex-col gap-2.5 text-[12px] leading-relaxed text-stone-600">
                  <li className="flex gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-stone-400" aria-hidden />
                    <span>
                      <span className="font-semibold text-stone-800">Name the asset</span>
                      {" "}— e.g. P-204, not &ldquo;the pump&rdquo;
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-stone-400" aria-hidden />
                    <span>
                      <span className="font-semibold text-stone-800">State the symptom</span>
                      {" "}— &ldquo;seal fails every 2 weeks&rdquo;
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-stone-400" aria-hidden />
                    <span>
                      <span className="font-semibold text-stone-800">Ask what you need</span>
                      {" "}— &ldquo;compare with OEM + SOP, recommend action&rdquo;
                    </span>
                  </li>
                </ul>
                <div className="mt-auto rounded-lg border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                    Golden example
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-stone-600 italic">
                    &ldquo;Investigate why Pump P-204 has failed repeatedly.
                    Compare maintenance history with the OEM manual and safety SOP.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 02 ISSUE / ASSET IMAGE ── */}
          <div className="border-x border-b border-stone-200 bg-white p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold text-stone-600 shrink-0">02</span>
              <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
                Issue / Asset Image
                <span className="ml-2 font-normal normal-case tracking-normal text-stone-400">optional</span>
              </p>
            </div>

            {/* Tall drop zone / preview */}
            {imageFile && previewUrl ? (
              <div className="flex items-start gap-5">
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Issue / asset preview"
                    className="h-48 w-48 rounded-lg border border-stone-300 object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleImageRemove}
                    aria-label="Remove image"
                    className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </div>
                <div className="flex flex-col gap-1 pt-1">
                  <p className="text-[13px] font-medium text-stone-800">{imageFile.name}</p>
                  <p className="text-[11px] text-stone-500">
                    {(imageFile.size / 1024).toFixed(0)} KB · {imageFile.type.replace("image/", "").toUpperCase()}
                  </p>
                  <button
                    type="button"
                    onClick={() => document.getElementById("image-upload-input")?.click()}
                    className="mt-1 w-fit text-[11px] font-medium text-stone-600 transition hover:text-stone-900"
                  >
                    Replace image
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById("image-upload-input")?.click()}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition",
                  imageError
                    ? "border-red-300 bg-red-50"
                    : "border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100"
                )}
              >
                <ImagePlus className="size-8 text-stone-400" aria-hidden />
                <div className="text-center">
                  <p className="text-[13px] font-medium text-stone-700">Upload image</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">JPEG, PNG, WebP or GIF · max 10 MB</p>
                </div>
              </button>
            )}

            <input
              id="image-upload-input"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-label="Upload issue or asset image"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) handleImageSelect(picked);
                e.target.value = "";
              }}
            />

            {imageError && (
              <p role="alert" className="text-[11px] text-red-600">{imageError}</p>
            )}
            <p className="text-[11px] text-stone-500">
              Visual context helps NIRVA correlate findings with physical equipment state.
            </p>
          </div>

          {/* ── 03 EQUIPMENT ID ── */}
          <div className="rounded-b-xl border-x border-b border-stone-200 bg-white p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold text-stone-600 shrink-0">03</span>
              <Label htmlFor="equipment" className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
                Equipment ID
                <span className="ml-2 font-normal normal-case tracking-normal text-stone-400">optional</span>
              </Label>
            </div>
            <Input
              id="equipment"
              placeholder="e.g. P-204, TK-102A, HX-305"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              disabled={submitting}
              className="text-sm bg-white border-stone-300 text-stone-800 placeholder:text-stone-400 focus:border-stone-400"
            />
            <p className="text-[11px] text-stone-500">
              Helps NIRVA focus retrieval on documents tagged with this asset identifier.
            </p>
          </div>

        </div>

        {/* Errors / warnings + CTA */}
        {serverError  && <p role="alert"  className="mt-4 text-xs text-red-600">{serverError}</p>}
        {imageWarnMsg && <p role="status" className="mt-2 text-xs text-amber-600">⚠ {imageWarnMsg}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => router.push("/investigations")}
            className="text-stone-600 hover:text-stone-900"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="px-6">
            {submitting ? (imageFile ? "Uploading…" : "Starting…") : "Start Investigation →"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
