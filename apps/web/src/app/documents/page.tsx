"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/app-shell";
import { useStoredAuth } from "@/lib/auth-client";
import {
  ApiError,
  downloadDocumentsExcel,
  getDocumentContent,
  getDocumentFile,
  listDocuments,
  uploadDocument,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ROLES,
  type DocumentContentResponse,
  type DocumentOut,
  type DocumentType,
  type DocumentUploadResponse,
} from "@/lib/types";

const DOC_TYPES: DocumentType[] = [
  "manual",
  "sop",
  "work_order",
  "incident",
  "data",
];

const ROLE_LABELS: Record<string, string> = {
  engineer: "Engineer",
  safety_officer: "Safety Officer",
  supervisor: "Supervisor",
  admin: "Admin",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "indexed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "quarantined":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300";
    default:
      return "";
  }
}

export function isImageFile(file: { name: string; type: string }): boolean {
  const imageExtensions = [".jpg", ".jpeg", ".png"];
  return (
    file.type.startsWith("image/") ||
    imageExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  );
}

export function DocumentsTable({
  documents,
  onOpen,
}: {
  documents: DocumentOut[];
  onOpen: (doc: DocumentOut) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Revision</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Department</th>
            <th className="px-3 py-2">Equipment</th>
            <th className="px-3 py-2">Uploaded</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.document_id} className="border-t">
              <td className="max-w-56 truncate px-3 py-2 font-medium">
                {d.title}
              </td>
              <td className="px-3 py-2">{d.document_type}</td>
              <td className="px-3 py-2">{d.revision}</td>
              <td className="px-3 py-2">
                <Badge variant="secondary" className={cn(statusBadgeClass(d.status))}>
                  {d.status}
                </Badge>
              </td>
              <td className="px-3 py-2">{d.department}</td>
              <td className="px-3 py-2">{d.equipment_id ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {new Date(d.uploaded_at).toLocaleDateString()}
              </td>
              <td className="px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpen(d)}
                  aria-label={`View chunks of ${d.title}`}
                >
                  Chunks
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChunkViewer({
  open,
  onOpenChange,
  documentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
}) {
  const [content, setContent] = useState<DocumentContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !documentId) return;
    const signal = { cancelled: false };
    let createdUrl: string | null = null;
    queueMicrotask(() => {
      void getDocumentContent(documentId)
        .then((c) => {
          if (!signal.cancelled) {
            setContent(c);
            setError(null);
          }
          // Image preview: fetch the stored original as an authed blob.
          return getDocumentFile(documentId)
            .then((blob) => {
              if (signal.cancelled) return;
              if (blob.type.startsWith("image/")) {
                createdUrl = URL.createObjectURL(blob);
                setImageUrl(createdUrl);
              }
            })
            .catch(() => {
              // Not an image / file missing — no preview, chunks still render.
            });
        })
        .catch((e: unknown) => {
          if (!signal.cancelled) {
            setError(
              e instanceof ApiError
                ? e.body.detail
                : "Failed to load document content"
            );
          }
        });
    });
    return () => {
      signal.cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setImageUrl(null);
    };
  }, [open, documentId]);

  // Content is keyed by document_id so switching documents shows loading
  // instead of stale chunks — no state reset needed on close.
  const stale = content !== null && documentId !== content.document.document_id;
  const shown = stale ? null : content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col !max-w-none"
        style={{ width: "min(95vw, 860px)", maxHeight: "88vh" }}
      >
        <DialogHeader className="px-8 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">
            {shown?.document.title ?? "Document"}
          </DialogTitle>
          <DialogDescription>
            {shown
              ? `${shown.document.revision} · ${shown.document.confidentiality_level} · ${shown.chunks.length} chunks`
              : "Loading chunks…"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-destructive text-sm">{error}</p>
          )}
          {imageUrl && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Stored original
              </p>
              {/* Blob URL from the authed file endpoint — next/image not applicable */}
              <img
                src={imageUrl}
                alt={`Stored original for ${shown?.document.title ?? "document"}`}
                className="max-h-72 w-auto rounded-lg border border-neutral-800 bg-neutral-950 object-contain"
              />
            </section>
          )}
          {shown && shown.chunks.length === 0 && (
            <p className="text-muted-foreground text-sm">No indexed chunks for this document.</p>
          )}
          {shown && shown.chunks.length > 0 && shown.chunks.map((c) => (
            <div key={c.chunk_id} className="rounded-lg border border-border bg-muted/20 px-5 py-4 flex flex-col gap-2.5">
              {/* Chunk header */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Page {c.page ?? "?"}
                  {c.section ? ` · §${c.section}` : ""}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/60 break-all">
                  {c.chunk_id}
                </span>
              </div>
              {/* Chunk text */}
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {c.text}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocumentType>("manual");
  const [revision, setRevision] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [department, setDepartment] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [allowedRoles, setAllowedRoles] = useState<string[]>(["engineer"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentUploadResponse | null>(null);

  const toggleRole = (role: string) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setResult(null);
      if (!file) {
        setError("Choose a file to upload.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await uploadDocument({
          file,
          title: title.trim(),
          document_type: docType,
          revision: revision.trim(),
          effective_date: effectiveDate,
          department: department.trim(),
          equipment_id: equipmentId.trim() || null,
          confidentiality_level: "internal",
          allowed_roles: allowedRoles.length > 0 ? allowedRoles : ["engineer"],
        });
        setResult(res);
        onUploaded();
      } catch (err: unknown) {
        setError(
          err instanceof ApiError
            ? err.body.detail
            : "Upload failed — try again."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      file,
      title,
      docType,
      revision,
      effectiveDate,
      department,
      equipmentId,
      allowedRoles,
      onUploaded,
    ]
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-file">File</Label>
          <Input
            id="doc-file"
            type="file"
            accept=".pdf,.csv,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && isImageFile(file) && (
            <p className="text-muted-foreground text-xs">
              Photo — vision inspection at upload: the local vision model will
              record observations-only text at ingestion.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-type">Type</Label>
          <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
            <SelectTrigger id="doc-type" aria-label="Document type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-revision">Revision</Label>
          <Input
            id="doc-revision"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-date">Effective date</Label>
          <Input
            id="doc-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-dept">Department</Label>
          <Input
            id="doc-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-equipment">Equipment ID (optional)</Label>
          <Input
            id="doc-equipment"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Allowed roles</Label>
          <div className="flex flex-wrap gap-2 pt-1">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={allowedRoles.includes(r)}
                  onChange={() => toggleRole(r)}
                />
                {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {result && (
        <p
          role="status"
          className={cn(
            "rounded border p-2 text-sm",
            result.duplicate
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          )}
        >
          {result.duplicate
            ? "Already indexed — exact content hash matched an existing document."
            : `Upload ${result.status} — ${result.chunks} chunk(s) indexed.`}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}

export default function DocumentsPage() {
  const auth = useStoredAuth();
  const role = auth?.user.role ?? "";
  const canUpload = role === "engineer" || role === "admin";

  const [documents, setDocuments] = useState<DocumentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const onExportLibrary = () => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    void downloadDocumentsExcel()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "nirva-documents.xlsx";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      })
      .catch((e: unknown) => {
        setExportError(
          e instanceof ApiError ? e.body.detail : "Export failed"
        );
      })
      .finally(() => setExportBusy(false));
  };

  const load = useCallback((signal: { cancelled: boolean }) => {
    void listDocuments()
      .then((docs) => {
        if (!signal.cancelled) {
          setDocuments(docs);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!signal.cancelled) {
          setError(
            e instanceof ApiError ? e.body.detail : "Failed to load documents"
          );
        }
      });
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    queueMicrotask(() => load(signal));
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  return (
    <AppShell title="Document library">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {!documents && !error ? (
          <div className="h-48 animate-pulse rounded bg-muted/50" aria-busy="true" />
        ) : (
          <div className="flex flex-col gap-6">
            <section>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide">
                  Library ({documents?.length ?? 0})
                </h2>
                {documents && documents.length > 0 && (
                  <span className="inline-flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onExportLibrary}
                      disabled={exportBusy}
                      className="bg-white"
                    >
                      {exportBusy ? "Exporting…" : "Export Excel"}
                    </Button>
                    {exportError && (
                      <span role="alert" className="text-xs text-red-700 dark:text-red-400">
                        {exportError}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mb-2 text-xs">
                List is ACL-filtered by the API for your role — you only see
                documents you are allowed to see.
              </p>
              {documents && documents.length === 0 && (
                <p className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-5 py-6 text-sm text-neutral-500">
                  No documents visible for your role yet — engineers and admins
                  can upload the first one.
                </p>
              )}
              {documents && documents.length > 0 && (
                <DocumentsTable
                  documents={documents}
                  onOpen={(d) => setViewerId(d.document_id)}
                />
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                Upload
              </h2>
              {canUpload ? (
                <div className="rounded-lg border p-4">
                  <UploadForm
                    onUploaded={() => {
                      const signal = { cancelled: false };
                      load(signal);
                    }}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Document upload is restricted to engineers and admins.
                </p>
              )}
            </section>
          </div>
        )}
      </main>
      <ChunkViewer
        open={viewerId !== null}
        onOpenChange={(o) => {
          if (!o) setViewerId(null);
        }}
        documentId={viewerId}
      />
    </AppShell>
  );
}
