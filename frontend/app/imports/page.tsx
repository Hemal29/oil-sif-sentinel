"use client";
import { AppShell } from "@/components/common/AppShell";
import { UploadWorkspace } from "@/components/imports/UploadWorkspace";
import { PageHeader } from "@/components/ui/primitives";

export default function ImportsPage() {
  return (
    <AppShell title="Imports">
      <div className="space-y-5">
        <PageHeader
          eyebrow="HSE · System"
          title="Import Safety Reports"
          description="Bulk-import safety reports from CSV, XLS or XLSX for AI-assisted precursor analysis."
        />
        <UploadWorkspace heading="Import Reports from File" subheading="Validated row by row · max 10 MB" />
      </div>
    </AppShell>
  );
}
