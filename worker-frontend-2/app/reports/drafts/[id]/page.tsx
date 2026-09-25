"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function DraftEditRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    if (params.id) router.replace(`/reports/new?draftId=${params.id}`);
  }, [params.id, router]);
  return (
    <main className="page-canvas">
      <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-[13px] text-[#627D98]">Loading draft…</p>
      </div>
    </main>
  );
}
