"use client";
import { AppShell } from "@/components/common/AppShell";
import { UploadWorkspace } from "@/components/imports/UploadWorkspace";
import { PageHeader } from "@/components/ui/primitives";

export default function AnalyzePage() {
  return (
    <AppShell title="Analyze Reports">
      <div className="space-y-5">
        <PageHeader
          eyebrow="HSE · System"
          title="Analyze / Import Reports"
          description="Import safety reports for AI-assisted SIF precursor analysis."
        />
        <UploadWorkspace heading="Import Reports from File" subheading="Validated row by row · max 10 MB" />
      </div>
    </AppShell>
  );
}
