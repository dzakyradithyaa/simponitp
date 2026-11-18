import {
  CheckCircle,
  Info,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Intensity } from "@/lib/types";

export const LEVEL_COLOR: Record<Intensity, string> = {
  rendah: "#4c8c4a",
  sedang: "#e0a526",
  tinggi: "#c0392b",
};
export const LEVEL_LABEL: Record<Intensity, string> = {
  rendah: "Rendah",
  sedang: "Sedang",
  tinggi: "Tinggi",
};

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 text-army-600"
      role="status"
    >
      <SpinnerGap className="h-4 w-4 animate-spin" weight="light" aria-hidden />{" "}
      {label ?? "Memuat..."}
    </span>
  );
}

export function IntensityBadge({ intensity }: { intensity: Intensity | null }) {
  if (!intensity)
    return (
      <span className="rounded bg-army-100 px-2 py-0.5 text-xs font-medium text-army-600">
        Belum ada data NDVI
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: LEVEL_COLOR[intensity] }}
    >
      Intensitas {LEVEL_LABEL[intensity].toLowerCase()}
    </span>
  );
}

export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-army-200 bg-army-50 text-army-700",
    error: "border-gold-500/40 bg-[#FDECEC] text-gold-600",
    success: "border-army-200 bg-army-50 text-army-800",
  }[kind];
  const Icon =
    kind === "success" ? CheckCircle : kind === "error" ? WarningCircle : Info;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-5 ${styles}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" weight="light" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-army-300 px-6 py-10 text-center">
      <p className="text-base font-semibold text-army-900">{title}</p>
      {children && <div className="mt-1 text-sm text-army-500">{children}</div>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-army-900/50 p-0 sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-md animate-sheet-in rounded-b-none p-5 shadow-xl sm:rounded-b-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
