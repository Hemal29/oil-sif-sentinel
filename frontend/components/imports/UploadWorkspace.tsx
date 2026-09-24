"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isUnauthorized, uploadReports } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import type { ImportSummary } from "@/types/import";
import { EmptyState, LoadingState } from "@/components/common/States";
import { AlertIcon, CheckIcon, ImportsIcon, XIcon } from "@/components/ui/Icons";
import { canReview, useCurrentUser } from "@/hooks/useCurrentUser";

const ACCEPTED = ".csv,.xls,.xlsx";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadWorkspace({ heading, subheading }: { heading: string; subheading: string }) {
  const router = useRouter();
  const user = useCurrentUser();
  const uploader = canReview(user);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);

  function pick(f: File | null | undefined) {
    setError("");
    setResult(null);
    if (!f) {
      setFile(null);
      return;
    }
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (![".csv", ".xls", ".xlsx"].includes(ext)) {
      setError(`Unsupported file type "${ext}". Only CSV, XLS and XLSX are accepted.`);
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError(`File is ${formatBytes(f.size)}. Maximum accepted size is 10 MB.`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    pick(e.target.files?.[0] ?? null);
    e.target.value = "";
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files?.[0]);
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const s = await uploadReports(file);
      setResult(s);
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        logout();
        router.push("/login?expired=1");
        return;
      }
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const inputId = `file-input-${heading.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div className="space-y-5">
      {!uploader ? (
        <div className="flex gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4" role="note">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]" />
          <p className="text-[13px] font-medium text-[#92400E]">Uploading reports requires HSE reviewer or admin role.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <section className="panel lg:col-span-3" aria-label="Upload">
          <div className="panel-header">
            <div>
              <h2 className="section-title">{heading}</h2>
              <p className="section-subtitle">{subheading}</p>
            </div>
            <span className="badge badge-neutral">CSV · XLS · XLSX</span>
          </div>
          <div className="panel-body">
            <form onSubmit={onUpload} className="space-y-4">
              <div
                className={
                  dragOver
                    ? "rounded-2xl border-2 border-[#2563EB] bg-[rgba(0,229,255,0.08)] p-8 text-center sm:p-10"
                    : "rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-white/[0.04] p-8 text-center transition-colors hover:border-[#94A3B8] sm:p-10"
                }
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                aria-label="File dropzone"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") document.getElementById(inputId)?.click();
                }}
              >
                <input type="file" accept={ACCEPTED} onChange={onSelect} className="hidden" id={inputId} aria-label="Select report file" />
                <label htmlFor={inputId} className="cursor-pointer">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-[#131B24] text-[#64748B]">
                    <ImportsIcon className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-[14px] font-semibold text-white">Drag &amp; drop your file here</p>
                  <p className="mt-1 text-[13px] text-[#64748B]">
                    or <span className="font-semibold text-[#00E5FF] underline">Choose File</span>
                  </p>
                </label>
              </div>
              {file ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3">
                  <p className="min-w-0 truncate text-[13px] text-white">
                    <strong className="font-semibold">{file.name}</strong> <span className="text-[#64748B]">({formatBytes(file.size)})</span>
                  </p>
                  <button type="button" onClick={() => setFile(null)} aria-label="Remove selected file" className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#E2E8F0]">
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {error ? (
                <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[13px] font-medium text-[#991B1B]" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={!file || busy || !uploader} className="button-primary w-full disabled:opacity-50">
                {busy ? "Uploading…" : "Upload Reports"}
              </button>
            </form>
          </div>
        </section>

        <aside className="panel h-fit lg:col-span-2" aria-label="Instructions">
          <div className="panel-header">
            <h2 className="section-title">How imports work</h2>
          </div>
          <div className="panel-body">
            <ol className="space-y-3.5 text-[13px] leading-relaxed text-[#94A3B8]">
              {[
                "Prepare a CSV, XLS or XLSX file using the import template columns.",
                "Files are validated row by row — invalid rows are rejected with reasons.",
                "Imported reports enter the standard workflow for AI screening and HSE review.",
                "Maximum file size is 10 MB per upload.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-[11px] font-bold text-white">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      {busy ? <LoadingState message="Uploading and validating…" /> : null}

      {result ? (
        <section className="panel" aria-label="Import summary">
          <div className="panel-header">
            <h2 className="section-title">Import Summary</h2>
            <span className="font-mono text-[11px] text-[#94A3B8]">{result.batchId}</span>
          </div>
          <div className="panel-body">
            <p className="text-[13.5px] text-white">{result.message}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Total rows</p>
                <p className="mt-1 text-[26px] font-bold tabular-nums text-white">{result.totalRows}</p>
              </div>
              <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-center">
                <p className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#15803D]">
                  <CheckIcon className="h-3.5 w-3.5" /> Imported
                </p>
                <p className="mt-1 text-[26px] font-bold tabular-nums text-[#15803D]">{result.imported}</p>
              </div>
              <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#991B1B]">Rejected</p>
                <p className="mt-1 text-[26px] font-bold tabular-nums text-[#991B1B]">{result.failed}</p>
              </div>
            </div>
            {result.errors.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-[13.5px] font-bold text-white">
                  Row-level errors ({result.errors.length}
                  {result.errorsTruncated ? ` shown, +${result.additionalErrors} more` : ""})
                </h3>
                <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.06]">
                  <table className="data-table min-w-[560px]">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Field</th>
                        <th>Code</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i}>
                          <td className="tabular-nums">{e.row}</td>
                          <td className="font-mono text-[12px]">{e.field}</td>
                          <td className="font-mono text-[12px]">{e.code}</td>
                          <td className="max-w-[320px] whitespace-normal">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-[13px] font-medium text-[#15803D]">
                All rows imported with no errors.{" "}
                <Link href="/reports" className="font-semibold underline">
                  View reports
                </Link>
              </p>
            )}
          </div>
        </section>
      ) : !busy ? (
        <EmptyState message="No import yet — select a file and upload to see row counts and validation results." />
      ) : null}
    </div>
  );
}
