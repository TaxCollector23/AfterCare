"use client";

import * as React from "react";
import { Files } from "lucide-react";
import { SplitViewer } from "@/components/documents/split-viewer";
import { DocumentSkeleton } from "@/components/ui/skeleton";
import {
  EmptyDocumentState,
  UploadFailedState,
  UnreadablePdfState,
  MissingInfoState,
  ConnectionLostState,
} from "@/components/documents/states";

type ViewState = "empty" | "uploading" | "ready" | "upload-failed" | "unreadable" | "missing-info" | "connection-lost";

const PREVIEW_OPTIONS: { value: ViewState; label: string }[] = [
  { value: "empty", label: "Empty" },
  { value: "ready", label: "Loaded" },
  { value: "upload-failed", label: "Upload failed" },
  { value: "unreadable", label: "Unreadable PDF" },
  { value: "missing-info", label: "Missing info" },
  { value: "connection-lost", label: "Connection lost" },
];

export default function DocumentsPage() {
  const [state, setState] = React.useState<ViewState>("empty");

  function simulateUpload() {
    setState("uploading");
    window.setTimeout(() => setState("ready"), 1400);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-blue-tint) text-(--color-blue)">
            <Files className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-h1">Documents</h1>
            <p className="text-body text-(--color-text-secondary)">Your original paperwork, in plain language</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-small text-(--color-text-tertiary)">
          Preview:
          <select
            value={state}
            onChange={(e) => setState(e.target.value as ViewState)}
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-small text-(--color-text-secondary)"
            aria-label="Preview a document view state"
          >
            {PREVIEW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {state === "empty" && <EmptyDocumentState onUpload={simulateUpload} />}
      {state === "uploading" && <DocumentSkeleton />}
      {state === "ready" && <SplitViewer />}
      {state === "upload-failed" && <UploadFailedState onRetry={() => setState("empty")} />}
      {state === "unreadable" && <UnreadablePdfState onRetry={() => setState("empty")} />}
      {state === "missing-info" && <MissingInfoState onContinue={() => setState("ready")} />}
      {state === "connection-lost" && <ConnectionLostState onRetry={simulateUpload} />}
    </div>
  );
}
