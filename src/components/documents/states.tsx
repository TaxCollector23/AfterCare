import { FileX2, FileWarning, FilePlus2, WifiOff, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

function StateShell({
  icon: Icon,
  iconTint,
  iconColor,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  iconTint: string;
  iconColor: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-(--color-border-strong) py-20 px-6 text-center">
      <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${iconTint} ${iconColor}`}>
        <Icon className="h-8 w-8" aria-hidden="true" />
      </span>
      <p className="text-h3">{title}</p>
      <p className="text-body text-(--color-text-secondary) max-w-sm">{description}</p>
      {action}
    </div>
  );
}

export function EmptyDocumentState({ onUpload }: { onUpload: () => void }) {
  return (
    <StateShell
      icon={FilePlus2}
      iconTint="bg-(--color-blue-tint)"
      iconColor="text-(--color-blue)"
      title="No document uploaded yet"
      description="Upload your hospital discharge paperwork and we'll turn it into a clear, easy-to-read summary."
      action={
        <Button onClick={onUpload}>
          <UploadCloud className="h-5 w-5" aria-hidden="true" />
          Upload Discharge Summary
        </Button>
      }
    />
  );
}

export function UploadFailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateShell
      icon={FileX2}
      iconTint="bg-(--color-red-tint)"
      iconColor="text-(--color-red)"
      title="Upload failed"
      description="Something went wrong while uploading your file. Check your connection and try again."
      action={<Button variant="danger" onClick={onRetry}>Try Again</Button>}
    />
  );
}

export function UnreadablePdfState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateShell
      icon={FileWarning}
      iconTint="bg-(--color-amber-tint)"
      iconColor="text-(--color-amber-dark)"
      title="We couldn't read this file"
      description="This document may be a scanned image without readable text, or it may be corrupted. Try a clearer scan or a different file."
      action={<Button variant="secondary" onClick={onRetry}>Choose a Different File</Button>}
    />
  );
}

export function MissingInfoState({ onContinue }: { onContinue: () => void }) {
  return (
    <StateShell
      icon={FileWarning}
      iconTint="bg-(--color-amber-tint)"
      iconColor="text-(--color-amber-dark)"
      title="Some medication details are missing"
      description="We found your discharge summary, but couldn't confidently identify all medication doses. Please review your medications page carefully and confirm with your pharmacist."
      action={<Button variant="secondary" onClick={onContinue}>Review Medications</Button>}
    />
  );
}

export function ConnectionLostState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateShell
      icon={WifiOff}
      iconTint="bg-slate-100 dark:bg-white/10"
      iconColor="text-(--color-text-secondary)"
      title="Connection lost"
      description="We can't reach the server right now. Check your internet connection and try again."
      action={<Button variant="secondary" onClick={onRetry}>Retry</Button>}
    />
  );
}
