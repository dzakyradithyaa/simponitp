import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { Intensity } from "@/lib/types";

export const LEVEL_COLOR: Record<Intensity, string> = { rendah: "#4c8c4a", sedang: "#e0a526", tinggi: "#c0392b" };
export const LEVEL_LABEL: Record<Intensity, string> = { rendah: "Rendah", sedang: "Sedang", tinggi: "Tinggi" };

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-army-700" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label ?? "Memuat..."}
    </span>
  );
}

export function IntensityBadge({ intensity }: { intensity: Intensity | null }) {
  if (!intensity) return <span className="rounded bg-army-100 px-2 py-0.5 text-xs font-medium text-army-700">Belum ada data NDVI</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ background: LEVEL_COLOR[intensity] }}>
      Intensitas {LEVEL_LABEL[intensity].toLowerCase()}
    </span>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "border-army-300 bg-army-50 text-army-800",
    error: "border-alert/40 bg-red-50 text-alert",
    success: "border-army-400 bg-army-100 text-army-800",
  }[kind];
  const Icon = kind === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-army-300 px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold text-army-800">{title}</p>
      {children && <div className="mt-1 text-sm text-army-600">{children}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-army-950/60 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="card w-full max-w-md p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
