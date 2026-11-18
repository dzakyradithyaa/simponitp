"use client";

import {
  CaretDown,
  DownloadSimple,
  PushPin,
  WarningCircle,
} from "@phosphor-icons/react";
import { LEVELS3, exportPolygonKml, summarize } from "@/lib/analysis";
import type { PolyAnalysis, Summary } from "@/lib/analysis";
import type { CellProps, Intensity, PolygonItem, Rule } from "@/lib/types";
import { IntensityBadge, LEVEL_COLOR, LEVEL_LABEL } from "./ui";

/*
 * Kartu analisis yang menempel (pinned) di dasar panel Alur kerja.
 * - Mode petak: satu petak = analisis per petak; banyak petak = gabungan.
 * - Mode custom: analisis polygon yang dipilih, dihitung dari petak 1 ha
 *   yang bersinggungan dengan polygon.
 */

const fmtHa = (v: number) =>
  v.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const fmtN = (v: number | null) => (v == null ? "-" : v.toFixed(2));

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e6e6e6] bg-[#f6f6f6] p-2">
      <div className="text-[10px] text-[#6b6b6b]">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums text-[#202020]">
        {value}
      </div>
    </div>
  );
}

function Distribution({ s }: { s: Summary }) {
  const total = LEVELS3.reduce((a, k) => a + s.by[k].ha, 0);
  if (!total) return null;
  return (
    <div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-[#ececec]"
        role="img"
        aria-label="Sebaran intensitas"
      >
        {LEVELS3.map((k) =>
          s.by[k].ha ? (
            <span
              key={k}
              style={{
                width: `${(s.by[k].ha / total) * 100}%`,
                background: LEVEL_COLOR[k],
              }}
            />
          ) : null
        )}
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {LEVELS3.map((k) => (
          <li
            key={k}
            className="flex items-center justify-between text-[11px] text-[#3a3a3a]"
          >
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: LEVEL_COLOR[k] }}
              />
              {LEVEL_LABEL[k]}
            </span>
            <span className="tabular-nums text-[#6b6b6b]">
              {s.by[k].cells} petak · {fmtHa(s.by[k].ha)} ha
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Actions({ rules, level }: { rules: Rule[]; level: Intensity | null }) {
  const rule = rules.find((r) => r.intensity === level);
  if (!level || !rule) return null;
  return (
    <div>
      <h4 className="mb-1 text-[11px] font-bold text-[#202020]">
        Saran tindakan · intensitas {LEVEL_LABEL[level].toLowerCase()}
      </h4>
      <ul className="divide-y divide-[#efefef] rounded-md border border-[#e6e6e6]">
        {rule.actions.map((a) => (
          <li
            key={a.title}
            className="flex items-baseline justify-between gap-2 px-2 py-1.5"
          >
            <span className="text-[11px] font-semibold text-[#202020]">
              {a.title}
            </span>
            <span className="shrink-0 text-[10px] text-[#6b6b6b]">
              {a.interval_label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisCard({
  mode,
  cells,
  polygon,
  polyAnalysis,
  hasGrid,
  cellSizeM,
  rules,
  open,
  onToggle,
  surveyLabel,
}: {
  mode: "petak" | "custom";
  cells: CellProps[];
  polygon: PolygonItem | null;
  polyAnalysis: PolyAnalysis | null;
  hasGrid: boolean;
  cellSizeM?: number;
  rules: Rule[];
  open: boolean;
  onToggle: () => void;
  surveyLabel?: string;
}) {
  const sizeText = cellSizeM
    ? `${Math.round(cellSizeM)} × ${Math.round(cellSizeM)} m`
    : "1 ha";
  let scope = "Belum ada pilihan";
  let body: React.ReactNode;

  if (mode === "petak") {
    if (cells.length === 0) {
      body = (
        <p className="text-xs leading-5 text-[#6b6b6b]">
          Klik satu atau beberapa petak pada peta untuk melihat analisisnya.
        </p>
      );
    } else if (cells.length === 1) {
      const c = cells[0];
      scope = `Petak ${c.cell_id}`;
      body = (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm text-[#202020]">{c.cell_id}</strong>
            <IntensityBadge intensity={c.intensity} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Tile
              label="Luas"
              value={`${fmtHa(c.area_ha)} ha${c.is_full ? "" : "*"}`}
            />
            <Tile label="NDVI rata-rata" value={fmtN(c.ndvi_mean)} />
            <Tile
              label="Rentang"
              value={
                c.ndvi_min == null
                  ? "-"
                  : `${fmtN(c.ndvi_min)}–${fmtN(c.ndvi_max)}`
              }
            />
          </div>
          <p className="text-[10px] text-[#6b6b6b]">
            {c.is_full
              ? `Ukuran petak ${sizeText}.`
              : `Petak tepi lahan (sebagian), maksimal ${sizeText}.`}
          </p>
          <Actions rules={rules} level={c.intensity} />
        </div>
      );
    } else {
      const s = summarize(
        cells.map((c) => ({
          intensity: c.intensity,
          ndvi: c.ndvi_mean,
          ha: c.area_ha,
        }))
      );
      scope = `${cells.length} petak`;
      body = (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <Tile label="Petak" value={String(s.cells)} />
            <Tile label="Luas" value={`${fmtHa(s.area_ha)} ha`} />
            <Tile label="NDVI rata-rata" value={fmtN(s.ndvi_mean)} />
          </div>
          <Distribution s={s} />
          <p className="text-[10px] text-[#6b6b6b]">Tiap petak {sizeText}.</p>
          <Actions rules={rules} level={s.dominant} />
        </div>
      );
    }
  } else if (!polygon) {
    body = (
      <p className="text-xs leading-5 text-[#6b6b6b]">
        Pilih atau gambar polygon untuk melihat analisis NDVI di dalamnya.
      </p>
    );
  } else if (!hasGrid || !polyAnalysis) {
    scope = polygon.name;
    body = (
      <p className="flex items-start gap-1.5 text-xs leading-5 text-[#6b6b6b]">
        <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Polygon belum bisa dianalisis karena peta ini belum punya data petak
        NDVI.
      </p>
    );
  } else if (polyAnalysis.hits.length === 0) {
    scope = polygon.name;
    body = (
      <p className="flex items-start gap-1.5 text-xs leading-5 text-[#6b6b6b]">
        <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Polygon ini berada di luar area NDVI, jadi tidak ada data untuk
        dianalisis.
      </p>
    );
  } else {
    const a = polyAnalysis;
    scope = polygon.name;
    const outside =
      polygon.coverage_pct != null && polygon.coverage_pct < 99.5
        ? Math.round(100 - polygon.coverage_pct)
        : 0;
    body = (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <strong className="min-w-0 truncate text-sm text-[#202020]">
            {polygon.name}
          </strong>
          <IntensityBadge intensity={a.dominant} />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Tile label="Luas polygon" value={`${fmtHa(polygon.area_ha)} ha`} />
          <Tile label="Petak 1 ha" value={String(a.hits.length)} />
          <Tile label="NDVI rata-rata" value={fmtN(a.ndvi_mean)} />
        </div>
        <Distribution s={a} />
        <p className="text-[10px] text-[#6b6b6b]">
          Tiap petak penuh {sizeText}.
        </p>
        <Actions rules={rules} level={a.dominant} />
        {outside > 0 && (
          <p className="text-[11px] text-[#A3121A]">
            {outside}% area berada di luar batas lahan.
          </p>
        )}
        <button
          type="button"
          onClick={() => exportPolygonKml(polygon, a, rules, surveyLabel)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#D71920] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#B8141A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920] focus-visible:ring-offset-2"
        >
          <DownloadSimple className="h-3.5 w-3.5" aria-hidden="true" />
          Unduh KML berwarna + analisis
        </button>
        <p className="text-[10px] leading-4 text-[#6b6b6b]">
          Perkiraan dari petak 1 ha yang bersinggungan dengan polygon
          {surveyLabel ? ` (survey: ${surveyLabel})` : ""}.
        </p>
      </div>
    );
  }

  return (
    <section
      className="shrink-0 border-t border-[#e6e6e6] bg-white shadow-[0_-6px_16px_rgba(32,32,32,0.06)]"
      aria-label="Analisis"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D71920]"
      >
        <PushPin className="h-4 w-4 shrink-0 text-[#D71920]" weight="fill" />
        <span className="text-xs font-semibold text-[#202020]">Analisis</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-[#6b6b6b]">
          {scope}
        </span>
        <CaretDown
          className={`h-3.5 w-3.5 shrink-0 text-[#6b6b6b] transition-transform duration-300 ${
            open ? "" : "rotate-180"
          }`}
          weight="bold"
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-[420ms] ease-apple ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="max-h-[32vh] overflow-y-auto px-3 pb-3 sm:max-h-[42vh]">
            {body}
          </div>
        </div>
      </div>
    </section>
  );
}
