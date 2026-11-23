import {
  CheckCircle,
  Info,
  SpinnerGap,
  WarningCircle,
  X,
} from "@phosphor-icons/react/ssr";
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

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920]/40";
export const CARD = "rounded-xl border border-[#e6e6e6] bg-white";
export const INPUT = `h-9 w-full rounded-lg border border-[#d9d9d9] bg-white px-3 text-sm text-[#202020] placeholder:text-[#9a9a9a] transition focus:border-[#D71920] focus:outline-none focus:ring-2 focus:ring-[#D71920]/15 disabled:bg-[#f6f6f6] disabled:text-[#9a9a9a]`;
export const LABEL = "mb-1 block text-xs font-semibold text-[#4a4a4a]";
export const BTN =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 " +
  FOCUS;
export const BTN_PRIMARY = `${BTN} bg-[#D71920] text-white hover:bg-[#B8141A]`;
export const BTN_GHOST = `${BTN} border border-[#d9d9d9] bg-white text-[#202020] hover:border-[#202020]`;
export const BTN_DANGER = `${BTN} border border-[#f0c4c6] bg-white text-[#D71920] hover:bg-[#FDECEC]`;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "red" | "dark" | "amber" | "green";
  children: React.ReactNode;
}) {
  const t = {
    neutral: "bg-[#f1f1f1] text-[#4a4a4a]",
    red: "bg-[#FDECEC] text-[#D71920]",
    dark: "bg-[#202020] text-white",
    amber: "bg-[#fdf3dc] text-[#8a5a00]",
    green: "bg-[#e6f3ec] text-[#256b4a]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${t}`}
    >
      {children}
    </span>
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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1>{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
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
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-[#202020]/45 p-0 sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-md animate-sheet-in overflow-y-auto rounded-t-2xl bg-white p-5 shadow-[0_24px_60px_rgba(32,32,32,0.25)] sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className={`grid h-8 w-8 place-items-center rounded-lg text-[#6b6b6b] transition hover:bg-[#f1f1f1] ${FOCUS}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
