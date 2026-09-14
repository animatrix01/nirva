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

import { useRef, useState } from "react";
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

// ─── Field label ──────────────────────────────────────────────────────────────

function FieldNumber({ n }: { n: string }) {
  return (
    <span className="shrink-0 w-5 font-mono text-[11px] font-bold text-stone-600 select-none pt-px">
      {n}
    </span>
  );
}

// ─── Image attachment component ───────────────────────────────────────────────

function ImageAttachment({
  file,
  previewUrl,
  error,
  onSelect,
  onRemove,
}: {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) onSelect(picked);
    // Reset input so the same file can be re-selected after removal
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Upload issue or asset image"
        onChange={handleFileChange}
      />

      {file && previewUrl ? (
        /* ── Preview state ── */
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Issue / asset preview"
              className="h-32 w-32 rounded border border-stone-700 object-cover"
            />
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border border-stone-700 bg-stone-900 text-stone-400 transition hover:bg-stone-800 hover:text-white"
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>

          <div className="flex flex-col gap-1 pt-1 min-w-0">
            <p className="text-[12px] font-medium text-stone-300 truncate max-w-xs">
              {file.name}
            </p>
            <p className="text-[11px] text-stone-600">
              {(file.size / 1024).toFixed(0)} KB · {file.type.replace("image/", "").toUpperCase()}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-0.5 w-fit text-[11px] font-medium text-stone-500 transition hover:text-stone-300"
            >
              Replace image
            </button>
          </div>
        </div>
      ) : (
        /* ── Upload trigger ── */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex items-center gap-3 rounded border border-dashed px-4 py-3 text-left transition",
            error
              ? "border-red-800/60 bg-red-950/10"
              : "border-stone-700 bg-stone-900/30 hover:border-stone-600 hover:bg-stone-900/50"
          )}
        >
          <ImagePlus className="size-4 shrink-0 text-stone-600" aria-hidden />
          <div>
            <p className="text-[12px] font-medium text-stone-400">Upload image</p>
            <p className="text-[11px] text-stone-600">
              JPEG, PNG, WebP or GIF · max 10 MB
            </p>
          </div>
        </button>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-red-400">
          {error}
        </p>
      )}
    </div>
  );
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
    <AppShell title="New investigation">
      <div className="mb-3">
        <BackTo href="/investigations" />
      </div>

      <div className="max-w-2xl">

        {/* Page title */}
        <div className="mb-5">
          <h1 className="text-[20px] font-bold text-white tracking-tight">
            New investigation
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
            Describe the equipment issue or investigation objective. NIRVA will
            retrieve relevant plant evidence and build an evidence-backed finding.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="rounded border border-stone-800 bg-stone-900/30 divide-y divide-stone-800">

            {/* ── 01  INVESTIGATION OBJECTIVE ── */}
            <div className="flex gap-4 px-5 py-5">
              <FieldNumber n="01" />
              <div className="flex-1 flex flex-col gap-2">
                <Label
                  htmlFor="objective"
                  className="text-[11px] font-bold uppercase tracking-widest text-stone-400"
                >
                  Investigation objective
                </Label>
                <textarea
                  id="objective"
                  rows={4}
                  className={cn(
                    "w-full rounded border bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-stone-100 outline-none resize-none transition",
                    "placeholder:text-stone-700",
                    objectiveError
                      ? "border-red-800/60 focus:border-red-700"
                      : "border-stone-700 focus:border-stone-500"
                  )}
                  placeholder="e.g. Investigate why Pump P-204 has failed repeatedly. Compare maintenance history with the OEM manual and safety SOP."
                  value={objective}
                  onChange={(e) => {
                    setObjective(e.target.value);
                    if (objectiveError) setObjectiveError(validateObjective(e.target.value));
                  }}
                  disabled={submitting}
                  required
                />
                {objectiveError && (
                  <p role="alert" className="text-[11px] text-red-400">
                    {objectiveError}
                  </p>
                )}
              </div>
            </div>

            {/* ── 02  EQUIPMENT ID ── */}
            <div className="flex gap-4 px-5 py-5">
              <FieldNumber n="02" />
              <div className="flex-1 flex flex-col gap-2">
                <Label
                  htmlFor="equipment"
                  className="text-[11px] font-bold uppercase tracking-widest text-stone-400"
                >
                  Equipment ID
                  <span className="ml-2 font-normal normal-case tracking-normal text-stone-600">
                    optional
                  </span>
                </Label>
                <Input
                  id="equipment"
                  placeholder="e.g. P-204"
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  disabled={submitting}
                  className="max-w-xs text-[13px]"
                />
                <p className="text-[11px] text-stone-600">
                  Helps NIRVA focus evidence retrieval on the selected asset.
                </p>
              </div>
            </div>

            {/* ── 03  ISSUE / ASSET IMAGE ── */}
            <div className="flex gap-4 px-5 py-5">
              <FieldNumber n="03" />
              <div className="flex-1 flex flex-col gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
                  Issue / asset image
                  <span className="ml-2 font-normal normal-case tracking-normal text-stone-600">
                    optional
                  </span>
                </p>
                <p className="text-[11px] text-stone-600">
                  Add a photo of the equipment or visible issue for investigation context.
                </p>
                <ImageAttachment
                  file={imageFile}
                  previewUrl={previewUrl}
                  error={imageError}
                  onSelect={handleImageSelect}
                  onRemove={handleImageRemove}
                />
              </div>
            </div>

          </div>

          {/* Errors / warnings */}
          {serverError && (
            <p role="alert" className="mt-3 text-[12px] text-red-400">
              {serverError}
            </p>
          )}
          {imageWarnMsg && (
            <p role="status" className="mt-3 text-[12px] text-amber-400">
              ⚠ {imageWarnMsg}
            </p>
          )}

          {/* Action bar */}
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => router.push("/investigations")}
              className="text-stone-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? imageFile
                  ? "Uploading…"
                  : "Starting…"
                : "Start investigation"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
