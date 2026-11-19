"use client";

import {
  ArrowUUpLeft,
  CalendarBlank,
  CaretDown,
  Check,
  CursorClick,
  GridFour,
  MagnifyingGlass,
  PencilSimple,
  MapTrifold,
  NavigationArrow,
  DownloadSimple,
  Info,
  IconContext,
  PencilRuler,
  SidebarSimple,
  Stack,
  Trash,
  X,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IntensityBadge,
  LEVEL_COLOR,
  LEVEL_LABEL,
  Notice,
  Spinner,
} from "@/components/ui";
import type { LayerToggles } from "@/components/MapCanvas";
import { AnalysisCard } from "@/components/AnalysisCard";
import { PIN_EVENT } from "@/components/PlaceSearch";
import type { PinTarget } from "@/components/PlaceSearch";
import { SurveyThumb } from "@/components/SurveyThumb";
import { analyzePolygon, exportPolygonKml } from "@/lib/analysis";
import { SAT_HD_URL } from "@/lib/basemap";
import type { Basemap } from "@/lib/basemap";
import type { PolyAnalysis } from "@/lib/analysis";
import { api, fmtHa, fmtNdvi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { boundsOf, polygonAreaHa } from "@/lib/geo";
import type {
  Analysis,
  Bounds,
  GridCollection,
  Intensity,
  MapItem,
  PolygonItem,
  Position,
  Rule,
} from "@/lib/types";

/*
 * Gaya Figma terang: satu bar atas (di Shell), panel properti menempel di kiri,
 * toolbar melayang di bawah, dan pill langkah di atas peta. Merah #D71920 hanya
 * untuk aksi utama dan langkah aktif. Ikon: Phosphor (light) lewat IconContext.
 */

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-[#f5f5f5]">
      <Spinner label="Memuat peta..." />
    </div>
  ),
});

const LEVELS: Intensity[] = ["rendah", "sedang", "tinggi"];

type Mode = "petak" | "custom";
type StepState = "done" | "active" | "todo";

const MODES: ReadonlyArray<readonly [Mode, string]> = [
  ["petak", "Lihat petak"],
  ["custom", "Custom petak"],
];

const STEP_TITLES: Record<Mode, string[]> = {
  petak: ["Pilih peta", "Analisis intensitas", "Pilih petak", "Ekspor"],
  custom: ["Pilih peta", "Gambar polygon", "Pilih polygon", "Ekspor"],
};

const BASEMAPS: ReadonlyArray<readonly [Basemap, string]> = [
  ["osm", "Jalan"],
  ["satellite", "Satelit"],
  ...(SAT_HD_URL ? ([["hd", "Satelit HD"]] as const) : []),
];

const LAYER_ITEMS = [
  ["boundary", "Batas lahan", "Garis batas area"],
  ["grid", "Petak 1 ha", "Grid analisis"],
  ["ndvi", "Raster TIFF / NDVI", "Citra hasil pemrosesan"],
  ["polygons", "Polygon custom", "Area digitasi"],
  ["labels", "Ukuran petak", "Panjang × lebar tiap petak"],
] as const;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920] focus-visible:ring-offset-2";

const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

const BTN_RED = `${BTN} bg-[#D71920] text-white hover:bg-[#B8141A] ${FOCUS}`;

const BTN_OUTLINE = `${BTN} border border-[#cfcfcf] bg-white text-[#202020] hover:bg-[#f4f4f4] ${FOCUS}`;

const LINK_BTN = `rounded text-[11px] font-semibold text-[#A3121A] hover:underline disabled:opacity-40 ${FOCUS}`;

const FIELD = `h-9 w-full rounded-md border border-[#cfcfcf] bg-white px-2.5 text-xs font-medium text-[#202020] outline-none transition disabled:opacity-50 ${FOCUS}`;

const LABEL = "mb-1 block text-[11px] font-semibold text-[#5a5a5a]";

const TILE = "rounded-md border border-[#e6e6e6] bg-[#f6f6f6] p-2.5";

const isMobile = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 767px)").matches;

function ExportBar({
  hrefFor,
  optionLabel,
  disabled,
}: {
  hrefFor: (fmt: "kml" | "kmz" | "poly", opt: boolean) => string;
  optionLabel: string;
  disabled?: boolean;
}) {
  const [opt, setOpt] = useState(false);

  return (
    <div>
      <div className="flex gap-2">
        {(["kml", "kmz", "poly"] as const).map((fmt) => (
          <a
            key={fmt}
            className={`flex-1 uppercase ${BTN_RED} ${
              disabled ? "pointer-events-none opacity-40" : ""
            }`}
            href={hrefFor(fmt, opt)}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : undefined}
          >
            <DownloadSimple className="h-3.5 w-3.5" aria-hidden="true" />
            {fmt}
          </a>
        ))}
      </div>

      <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs text-[#3a3a3a]">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[#D71920]"
          checked={opt}
          onChange={(e) => setOpt(e.target.checked)}
        />
        {optionLabel}
      </label>
    </div>
  );
}

function StepCard({
  n,
  title,
  state,
  badge,
  children,
}: {
  n: number;
  title: string;
  state: StepState;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Di layar kecil hanya langkah aktif yang terbuka; sisanya bisa dibuka manual.
  const [open, setOpen] = useState(() => state === "active" || !isMobile());
  useEffect(() => {
    if (state === "active") setOpen(true);
  }, [state]);

  return (
    <section
      className="border-b border-[#ececec] bg-white"
      aria-current={state === "active" ? "step" : undefined}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left transition-colors hover:bg-[#fafafa] ${FOCUS} ${
          state === "active" ? "border-l-[#D71920]" : "border-l-transparent"
        }`}
      >
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
            state === "done"
              ? "bg-[#202020] text-white"
              : state === "active"
              ? "bg-[#D71920] text-white"
              : "border border-[#cfcfcf] bg-white text-[#6b6b6b]"
          }`}
        >
          {state === "done" ? (
            <Check className="h-3 w-3" aria-label="Selesai" />
          ) : (
            n
          )}
        </span>

        <h3
          className={`min-w-0 flex-1 truncate text-xs font-semibold ${
            state === "todo" ? "text-[#6b6b6b]" : "text-[#202020]"
          }`}
        >
          {title}
        </h3>

        {badge}

        <CaretDown
          weight="bold"
          className={`h-3 w-3 shrink-0 text-[#6b6b6b] transition-transform duration-[420ms] ease-apple ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-[420ms] ease-apple ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pl-[calc(0.75rem+2px)] pt-0.5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionBar({
  bottom,
  shift,
  info,
  hint,
  children,
}: {
  bottom: string;
  shift: string;
  info: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute left-1/2 z-[27] w-[min(360px,calc(100%-16px))] -translate-x-1/2 animate-rise-center rounded-xl border border-[#e6e6e6] bg-white p-2 text-[#202020] shadow-[0_8px_28px_rgba(32,32,32,0.16)] ${bottom} ${shift}`}
    >
      <p className="truncate text-xs font-semibold tabular-nums">{info}</p>
      <p className="mb-1.5 truncate text-[11px] leading-tight text-[#6b6b6b]">{hint}</p>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export default function PetaSayaPage() {
  const { user } = useAuth();

  const [maps, setMaps] = useState<MapItem[] | null>(null);
  const [mapId, setMapId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MapItem | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [grid, setGrid] = useState<GridCollection | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [polygons, setPolygons] = useState<PolygonItem[]>([]);

  const [mode, setMode] = useState<Mode>("petak");

  const [layers, setLayers] = useState<LayerToggles>({
    boundary: true,
    grid: true,
    ndvi: true,
    polygons: true,
    labels: true,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const [draft, setDraft] = useState<Position[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [polyName, setPolyName] = useState("");
  const [selPoly, setSelPoly] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const [fit, setFit] = useState<{
    key: number;
    bounds: Bounds | null;
  }>({
    key: 0,
    bounds: null,
  });

  const [error, setError] = useState<string | null>(null);
  const [gridMsg, setGridMsg] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [panelOpen, setPanelOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyQ, setSurveyQ] = useState("");
  const [polyQ, setPolyQ] = useState("");
  const [mapQ, setMapQ] = useState("");
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [cellPopup, setCellPopup] = useState<{
    id: string;
    lng: number;
    lat: number;
  } | null>(null);
  const [rasterOpacity, setRasterOpacity] = useState(0.6);
  const [editId, setEditId] = useState<number | null>(null);
  const [editRing, setEditRing] = useState<Position[]>([]);
  const [pin, setPin] = useState<PinTarget | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("osm");
  const [toolsOpen, setToolsOpen] = useState(true);

  // Hasil pencarian wilayah / lokasi saya datang dari navbar.
  useEffect(() => {
    const on = (e: Event) => setPin((e as CustomEvent<PinTarget>).detail);
    window.addEventListener(PIN_EVENT, on);
    return () => window.removeEventListener(PIN_EVENT, on);
  }, []);

  // Ingat status laci tips antar kunjungan.
  useEffect(() => {
    try {
      if (localStorage.getItem("peta.tips") === "0") setTipsOpen(false);
    } catch {}
  }, []);
  const toggleTips = () =>
    setTipsOpen((o) => {
      try {
        localStorage.setItem("peta.tips", o ? "0" : "1");
      } catch {}
      return !o;
    });

  // Di layar kecil panel dimulai tertutup agar peta langsung terlihat.
  useEffect(() => {
    if (isMobile()) {
      setPanelOpen(false);
      setAnalysisOpen(false);
    }
  }, []);

  // Initial data
  useEffect(() => {
    let alive = true;

    Promise.all([
      api.get<MapItem[]>("/maps"),
      api.get<{ rules: Rule[]; disclaimer: string }>("/recommendations/rules"),
    ])
      .then(([m, r]) => {
        if (!alive) return;

        setMaps(m);
        setRules(r.rules);
        setDisclaimer(r.disclaimer);

        const wanted = Number(
          new URLSearchParams(window.location.search).get("map")
        );

        setMapId(
          (
            m.find((x) => x.id === wanted) ??
            m.find((x) => x.has_boundary) ??
            m[0]
          )?.id ?? null
        );
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });

    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Map changed: reset everything tied to the old map, then load the new one
  useEffect(() => {
    setSelected(new Set());
    setIntensity(null);
    setAnalysis(null);
    setSelPoly(null);
    setConfirmDel(null);
    setEditId(null);
    setEditRing([]);
    setDraft([]);
    setDrawing(false);
    setPending(false);
    setDetail(null);
    setPolygons([]);
    setVersionId(null);
    setGrid(null);
    setGridMsg(null);

    if (mapId == null) return;

    let alive = true;

    Promise.all([
      api.get<MapItem>(`/maps/${mapId}`),
      api.get<PolygonItem[]>(`/maps/${mapId}/polygons`),
    ])
      .then(([d, p]) => {
        if (!alive) return;

        setDetail(d);
        setPolygons(p);

        const ready = d.versions.filter((v) => v.status === "ready");

        setVersionId(
          (ready.find((v) => v.is_active) ?? ready[ready.length - 1])?.id ??
            null
        );

        setFit((f) => ({
          key: f.key + 1,
          bounds: d.bounds,
        }));
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });

    return () => {
      alive = false;
    };
  }, [mapId]);

  // Grid for map and version
  useEffect(() => {
    if (mapId == null || !detail || detail.id !== mapId) return;

    if (!detail.has_boundary) {
      setGrid(null);
      setGridMsg("Peta ini belum memiliki TIFF. Unggah TIFF di Upload Peta.");
      return;
    }

    let alive = true;

    api
      .get<GridCollection>(
        `/maps/${mapId}/grid${versionId ? `?version_id=${versionId}` : ""}`
      )
      .then((g) => {
        if (!alive) return;
        setGrid(g);
        setGridMsg(null);
      })
      .catch((e) => {
        if (!alive) return;
        setGrid(null);
        setGridMsg(e.message);
      });

    return () => {
      alive = false;
    };
  }, [mapId, versionId, detail]);

  // Recommendation analysis
  useEffect(() => {
    setAnalysis(null);

    if (!intensity || mapId == null || !grid) return;

    let alive = true;

    api
      .get<Analysis>(
        `/recommendations/analysis?map_id=${mapId}&intensity=${intensity}${
          versionId ? `&version_id=${versionId}` : ""
        }`
      )
      .then((a) => {
        if (alive) setAnalysis(a);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });

    return () => {
      alive = false;
    };
  }, [intensity, mapId, versionId, grid]);

  const version = detail?.versions.find((v) => v.id === versionId) ?? null;

  const tilesUrl =
    version &&
    version.status === "ready" &&
    version.has_tiles &&
    typeof window !== "undefined"
      ? `${window.location.origin}/api/maps/${mapId}/versions/${version.id}/tiles.pmtiles`
      : null;

  const ruleOf = (k: Intensity | null) => rules.find((r) => r.intensity === k);

  // Hanya petak yang benar-benar ada di grid aktif yang dihitung terpilih.
  const selectedCells = useMemo(
    () =>
      (grid?.features ?? [])
        .filter((f) => selected.has(f.properties.cell_id))
        .map((f) => f.properties),
    [grid, selected]
  );

  const selectedIds = useMemo(
    () => selectedCells.map((c) => c.cell_id),
    [selectedCells]
  );

  // Analisis + masking tiap polygon custom terhadap petak NDVI (di browser).
  const polyAnalyses = useMemo(() => {
    const out: Record<number, PolyAnalysis> = {};
    if (!grid) return out;
    for (const p of polygons)
      out[p.id] = analyzePolygon(p.geometry, grid.features);
    return out;
  }, [grid, polygons]);

  // Saat mengedit, hasil masking dihitung ulang langsung selama titik digeser.
  const editAnalysis = useMemo(() => {
    if (!grid || editId == null || editRing.length < 3) return null;
    return analyzePolygon(
      { type: "Polygon", coordinates: [[...editRing, editRing[0]]] },
      grid.features
    );
  }, [grid, editId, editRing]);

  const analysisOf = (id: number) =>
    editId === id && editAnalysis ? editAnalysis : polyAnalyses[id] ?? null;

  // Peta menampilkan bentuk hasil masking, bukan gambar mentah.
  const polygonsForMap = useMemo(
    () =>
      polygons.map((p) => {
        const a =
          editId === p.id && editAnalysis ? editAnalysis : polyAnalyses[p.id];
        return a?.masked ? { ...p, geometry: a.masked } : p;
      }),
    [polygons, polyAnalyses, editId, editAnalysis]
  );

  const polygonIntensity = useMemo(() => {
    const out: Record<number, Intensity | null> = {};
    for (const p of polygons)
      out[p.id] =
        (editId === p.id && editAnalysis ? editAnalysis : polyAnalyses[p.id])
          ?.dominant ?? null;
    return out;
  }, [polygons, polyAnalyses, editId, editAnalysis]);

  // Titik sudut asli tiap polygon custom (untuk pin 3D). Polygon yang sedang diedit memakai titik edit.
  const pinSets = useMemo(
    () =>
      polygons
        .filter((p) => p.id !== editId && p.geometry.type === "Polygon")
        .map((p) => ({
          id: p.id,
          coords: (
            p.geometry as { coordinates: Position[][] }
          ).coordinates[0].slice(0, -1),
        })),
    [polygons, editId]
  );

  const pendingAnalysis = useMemo(
    () =>
      pending && grid && draft.length >= 3
        ? analyzePolygon(
            { type: "Polygon", coordinates: [[...draft, draft[0]]] },
            grid.features
          )
        : null,
    [pending, grid, draft]
  );

  const toggleCell = useCallback((id: string, coords: Position) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
      setCellPopup((p) => (p?.id === id ? null : p));
    } else {
      next.add(id);
      setCellPopup({ id, lng: coords[0], lat: coords[1] });
    }
    setSelected(next);
  }, [selected]);

  const addPoint = useCallback((p: Position) => setDraft((d) => [...d, p]), []);

  const pickPolygon = useCallback((id: number) => setSelPoly(id), []);

  const cancelDraw = useCallback(() => {
    setDraft([]);
    setDrawing(false);
    setPending(false);
  }, []);

  const undoPoint = useCallback(() => setDraft((d) => d.slice(0, -1)), []);

  const finishDraw = useCallback(() => {
    if (draft.length < 3) return;
    setDrawing(false);
    setPending(true);
    setPanelOpen(true);
  }, [draft.length]);

  // Pintasan keyboard saat menggambar: Esc batal, Enter selesai, Backspace undo.
  useEffect(() => {
    if (!drawing) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelDraw();
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        tag === "BUTTON"
      )
        return;

      if (e.key === "Enter") {
        finishDraw();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        undoPoint();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, cancelDraw, finishDraw, undoPoint]);

  const cancelEdit = useCallback(() => {
    setEditId(null);
    setEditRing([]);
  }, []);

  useEffect(() => {
    if (editId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editId, cancelEdit]);

  const switchMode = (m: Mode) => {
    if (m === mode) return;

    setMode(m);
    cancelDraw();
    cancelEdit();
    setConfirmDel(null);

    // Pastikan layer yang dibutuhkan mode ini tidak sedang dimatikan.
    setLayers((l) =>
      m === "petak" ? { ...l, grid: true } : { ...l, polygons: true }
    );
  };

  const startDraw = () => {
    cancelEdit();
    setDrawing(true);
    setSelPoly(null);
    if (isMobile()) setPanelOpen(false);
  };

  const cellsHref = (fmt: "kml" | "kmz" | "poly", separate: boolean) => {
    const q = new URLSearchParams({
      map_id: String(mapId),
      format: fmt,
    });

    if (versionId) q.set("version_id", String(versionId));
    if (selectedIds.length) q.set("cell_ids", selectedIds.join(","));
    if (separate) q.set("separate", "true");

    return `/api/exports/cells?${q}`;
  };

  function startEdit(p: PolygonItem) {
    if (p.geometry.type !== "Polygon" || drawing || pending) return;
    setEditRing(p.geometry.coordinates[0].slice(0, -1));
    setEditId(p.id);
    setSelPoly(p.id);
    setConfirmDel(null);
    if (isMobile()) setPanelOpen(false);
  }

  // Backend belum punya endpoint ubah geometri, jadi: simpan versi baru lalu hapus yang lama.
  async function saveEdit() {
    const old = polygons.find((p) => p.id === editId);
    if (!old || mapId == null || editRing.length < 3 || saving) return;

    setSaving(true);
    setError(null);

    try {
      const created = await api.post<PolygonItem>(`/maps/${mapId}/polygons`, {
        name: old.name,
        note: old.note,
        geometry: {
          type: "Polygon",
          coordinates: [[...editRing, editRing[0]]],
        },
      });

      try {
        await api.del(`/polygons/${old.id}`);
      } catch {
        setError("Bentuk baru tersimpan, tetapi polygon lama gagal dihapus.");
      }

      setPolygons((l) => l.map((x) => (x.id === old.id ? created : x)));
      setSelPoly(created.id);
      cancelEdit();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function savePolygon() {
    if (saving || mapId == null || draft.length < 3 || !polyName.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const created = await api.post<PolygonItem>(`/maps/${mapId}/polygons`, {
        name: polyName.trim(),
        geometry: {
          type: "Polygon",
          coordinates: [[...draft, draft[0]]],
        },
      });

      setPolygons((p) => [created, ...p]);
      setSelPoly(created.id);
      setDraft([]);
      setPending(false);
      setPolyName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removePolygon(p: PolygonItem) {
    setError(null);

    try {
      await api.del(`/polygons/${p.id}`);

      setPolygons((l) => l.filter((x) => x.id !== p.id));
      if (selPoly === p.id) setSelPoly(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirmDel(null);
    }
  }

  if (error && !maps) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6">
        <Notice kind="error">{error}</Notice>
        <button
          type="button"
          className={BTN_RED}
          onClick={() => {
            setError(null);
            setReloadKey((k) => k + 1);
          }}
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!maps) return <Spinner />;

  const draftHa = polygonAreaHa(draft);
  const summary = grid?.summary;
  const selectedPolygon = polygons.find((p) => p.id === selPoly) ?? null;
  const selectedAnalysis = selectedPolygon
    ? analysisOf(selectedPolygon.id)
    : null;

  // Data siap dipakai langkah 2-4 pada mode aktif.
  const ready = mapId != null && (mode === "petak" ? !!grid : true);

  const lockedText =
    mapId == null
      ? "Pilih peta pada langkah 1 terlebih dahulu."
      : gridMsg
      ? "Data petak belum tersedia untuk peta ini."
      : "Memuat data petak...";

  // Langkah yang sedang aktif dan petunjuk berikutnya.
  let activeStep: number;
  let hint: string;

  if (mapId == null) {
    activeStep = 1;
    hint = maps.length
      ? "Buka panel Alur kerja, lalu pilih peta yang ingin dikerjakan."
      : "Belum ada peta. Unggah data TIFF terlebih dahulu.";
  } else if (mode === "petak") {
    if (gridMsg) {
      activeStep = 1;
      hint =
        "Peta ini belum bisa dianalisis. Lihat keterangannya di panel Alur kerja.";
    } else if (!grid) {
      activeStep = 1;
      hint = "Memuat data petak...";
    } else if (selectedIds.length > 0) {
      activeStep = 4;
      hint = `${selectedIds.length} petak dipilih. Unduh sebagai KML atau KMZ di langkah Ekspor.`;
    } else if (intensity) {
      activeStep = 3;
      hint = `Klik petak pada peta untuk memilihnya, atau pilih semua petak intensitas ${LEVEL_LABEL[
        intensity
      ].toLowerCase()}. Tanpa pilihan, ekspor mencakup semua petak.`;
    } else {
      activeStep = 2;
      hint =
        "Pilih tingkat intensitas untuk melihat saran tindakan, atau langsung klik petak pada peta. Langkah analisis boleh dilewati.";
    }
  } else if (pending) {
    activeStep = 2;
    hint = "Beri nama polygon, lalu simpan.";
  } else if (drawing) {
    activeStep = 2;
    hint =
      "Klik pada peta untuk menandai titik sudut. Minimal 3 titik, lalu tekan Selesai.";
  } else if (selPoly != null) {
    activeStep = 4;
    hint = "Polygon dipilih. Unduh sebagai KML atau KMZ di langkah Ekspor.";
  } else if (polygons.length) {
    activeStep = 3;
    hint =
      "Pilih polygon dari daftar untuk diekspor, atau gambar polygon baru.";
  } else {
    activeStep = 2;
    hint =
      "Tekan Gambar polygon baru, lalu klik pada peta untuk menandai area kerja.";
  }

  const stepState = (n: number): StepState =>
    n < activeStep ? "done" : n === activeStep ? "active" : "todo";

  const titles = STEP_TITLES[mode];

  const locked = (
    <p className="text-xs leading-5 text-[#5a5a5a]">{lockedText}</p>
  );

  // Lompat ke peta NDVI: pakai batas versi yang sedang dipilih.
  const ndviBounds = version?.bounds ?? detail?.bounds ?? null;
  const goNdvi = () => {
    if (!ndviBounds) return;
    setFit((f) => ({ key: f.key + 1, bounds: ndviBounds }));
  };

  const mq = mapQ.trim().toLowerCase();
  const mapsShown = mq
    ? maps.filter((m) =>
        `${m.name} ${m.description ?? ""}`.toLowerCase().includes(mq)
      )
    : maps;

  const pq = polyQ.trim().toLowerCase();
  const polygonsShown = pq
    ? polygons.filter((p) =>
        `${p.name} ${p.owner ?? ""} ${p.note ?? ""}`.toLowerCase().includes(pq)
      )
    : polygons;

  const monthOf = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  const thisMonth = monthOf(new Date().toISOString());
  const surveyList = [...(detail?.versions ?? [])].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
  );
  const q = surveyQ.trim().toLowerCase();
  const surveyShown = q
    ? surveyList.filter((v) =>
        [
          v.label,
          v.notes ?? "",
          v.original_filename,
          `v${v.version}`,
          monthOf(v.created_at),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : surveyList;
  const surveyGroups: [string, typeof surveyList][] = [];
  for (const v of surveyShown) {
    const m = monthOf(v.created_at);
    const g = surveyGroups.find((x) => x[0] === m);
    if (g) g[1].push(v);
    else surveyGroups.push([m, [v]]);
  }

  const toggleTools = () => {
    if (toolsOpen) setLayersOpen(false);
    setToolsOpen(!toolsOpen);
  };

  const shift = panelOpen ? "md:left-[calc(50%+150px)]" : "";

  return (
    <IconContext.Provider value={{ weight: "light" }}>
      <div className="relative h-[calc(100dvh-3.5rem)] min-h-[480px] w-full overflow-hidden bg-[#f5f5f5] text-[#202020]">
        <div className="absolute inset-0">
          <MapCanvas
            layers={layers}
            boundary={detail?.boundary ?? null}
            grid={grid}
            selected={selected}
            highlight={mode === "petak" ? intensity : null}
            tilesUrl={tilesUrl}
            polygons={polygonsForMap}
            polygonIntensity={polygonIntensity}
            rasterOpacity={rasterOpacity}
            basemap={basemap}
            compassClass={surveyOpen ? "right-3 sm:right-[332px]" : "right-3"}
            pinSets={pinSets}
            editing={editId != null ? editRing : null}
            onEditChange={setEditRing}
            pin={pin}
            selectedPolygonId={selPoly}
            mode={mode}
            drawing={drawing}
            draft={draft}
            fit={fit}
            onCellClick={toggleCell}
            cellPopup={
              cellPopup && selectedCells.some((c) => c.cell_id === cellPopup.id)
                ? {
                    ...cellPopup,
                    content: (
                      <AnalysisCard
                        mode="petak"
                        cells={[
                          selectedCells.find(
                            (c) => c.cell_id === cellPopup.id
                          )!,
                        ]}
                        polygon={null}
                        polyAnalysis={null}
                        hasGrid={!!grid}
                        cellSizeM={grid?.cell_size_m}
                        rules={rules}
                        open
                        onToggle={() => setCellPopup(null)}
                        popup
                        surveyLabel={
                          version
                            ? `v${version.version} · ${version.label}`
                            : undefined
                        }
                      />
                    ),
                  }
                : null
            }
            onPolygonClick={pickPolygon}
            onDrawPoint={addPoint}
          />
        </div>

        {/* Tips: laci yang bersembunyi di balik navbar, ditarik ke bawah lewat tab */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-[22] -translate-x-1/2">
          <div
            className="pointer-events-auto flex w-[min(340px,calc(100vw-120px))] flex-col items-center transition-transform duration-[420ms] ease-apple "
            style={{
              transform: tipsOpen
                ? "translateY(0)"
                : "translateY(calc(-100% + 24px))",
            }}
          >
            <div
              id="tips-body"
              role="status"
              aria-live="polite"
              className={`w-full rounded-b-xl border-x border-b border-[#e6e6e6] bg-white px-3 pb-2.5 pt-2.5 transition-shadow duration-300 ${
                tipsOpen ? "shadow-[0_8px_20px_rgba(32,32,32,0.14)]" : ""
              }`}
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-[#202020]">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D71920] text-[10px] font-bold text-white">
                  {activeStep}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {titles[activeStep - 1]}
                </span>
                <span className="text-[10px] font-normal tabular-nums text-[#6b6b6b]">
                  {activeStep}/4
                </span>
              </p>
              <p className="mt-1.5 text-[11px] leading-4 text-[#6b6b6b]">
                {hint}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTips}
              aria-expanded={tipsOpen}
              aria-controls="tips-body"
              title={tipsOpen ? "Sembunyikan tips" : "Tarik untuk melihat tips"}
              className={`-mt-px flex h-6 items-center gap-1.5 rounded-b-lg border-x border-b border-[#e6e6e6] bg-white px-3 text-[10px] font-semibold text-[#202020] transition-colors hover:text-[#D71920] ${FOCUS}`}
            >
              Tips
              <span className="font-normal tabular-nums text-[#6b6b6b]">
                langkah {activeStep}
              </span>
              <CaretDown
                weight="bold"
                className={`h-3 w-3 transition-transform duration-300 ${
                  tipsOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Error notice */}
        {error && (
          <div
            className="absolute left-1/2 top-28 z-40 flex w-[min(520px,calc(100%-24px))] -translate-x-1/2 items-start gap-2"
            role="alert"
          >
            <div className="min-w-0 flex-1">
              <Notice kind="error">{error}</Notice>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Tutup pesan"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-[#202020] shadow-md ${FOCUS}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Alur kerja */}
        <aside
          aria-label="Alur kerja"
          aria-hidden={!panelOpen}
          className={`absolute bottom-0 left-0 top-0 z-30 flex w-[min(300px,86vw)] flex-col border-r border-[#e6e6e6] bg-white transition-[transform,visibility,box-shadow] duration-[420ms] ease-apple ${
            panelOpen
              ? "visible translate-x-0 shadow-[8px_0_28px_rgba(32,32,32,0.10)]"
              : "invisible -translate-x-full"
          }`}
        >
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#e6e6e6] px-3">
            <h2 className="text-[13px] font-semibold text-[#202020]">
              Alur kerja
            </h2>

            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Tutup panel alur kerja"
              title="Tutup panel"
              className={`grid h-7 w-7 place-items-center rounded-md text-[#5a5a5a] transition hover:bg-[#f0f0f0] hover:text-[#202020] ${FOCUS}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Langkah 1: pilih peta */}
            <StepCard n={1} title={titles[0]} state={stepState(1)}>
              <div className="space-y-2.5">
                <div>
                  <label className={LABEL} htmlFor="sel-map-q">
                    Peta NDVI
                  </label>

                  <label className="relative block">
                    <MagnifyingGlass
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6b6b]"
                      aria-hidden="true"
                    />
                    <input
                      id="sel-map-q"
                      type="search"
                      value={mapQ}
                      onChange={(e) => setMapQ(e.target.value)}
                      placeholder="Cari nama peta"
                      className={`h-9 w-full rounded-md border border-[#cfcfcf] bg-white pl-8 pr-2.5 text-xs text-[#202020] placeholder:text-[#9a9a9a] ${FOCUS}`}
                    />
                  </label>

                  <p className="mt-1.5 text-[11px] leading-4 text-[#6b6b6b]">
                    Klik kartu untuk langsung menuju peta NDVI-nya.
                  </p>

                  {maps.length === 0 ? (
                    <p className="mt-2 text-xs text-[#6b6b6b]">
                      Belum ada peta.
                    </p>
                  ) : mapsShown.length === 0 ? (
                    <p className="mt-2 text-xs text-[#6b6b6b]">
                      Tidak ada peta yang cocok dengan pencarian.
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-60 space-y-1.5 overflow-y-auto pr-0.5">
                      {mapsShown.map((m) => {
                        const on = m.id === mapId;
                        const ver =
                          m.versions.find((v) => v.is_active && v.has_tiles) ??
                          [...m.versions].reverse().find((v) => v.has_tiles);
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              aria-pressed={on}
                              title={
                                on
                                  ? "Klik untuk kembali ke peta"
                                  : "Klik untuk menuju peta"
                              }
                              onClick={() => {
                                if (on) goNdvi();
                                else setMapId(m.id);
                                if (isMobile()) setPanelOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 rounded-md border p-1.5 text-left transition ${FOCUS} ${
                                on
                                  ? "border-[#D71920] bg-[#FDECEC]"
                                  : "border-[#e2e2e2] bg-white hover:border-[#D71920]"
                              }`}
                            >
                              <SurveyThumb
                                w={44}
                                h={44}
                                url={
                                  ver
                                    ? `${window.location.origin}/api/maps/${m.id}/versions/${ver.id}/tiles.pmtiles`
                                    : null
                                }
                                bounds={ver?.bounds ?? m.bounds}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold text-[#202020]">
                                  {m.name}
                                </span>
                                <span className="block truncate text-[11px] text-[#6b6b6b]">
                                  {m.area_ha != null &&
                                    `${fmtHa(m.area_ha)} ha · `}
                                  {m.versions.length} survey
                                  {!m.has_boundary && " · belum ada TIFF"}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {mapId != null && (
                    <button
                      type="button"
                      className={`mt-2 ${LINK_BTN}`}
                      onClick={() => setMapId(null)}
                    >
                      Peta dasar saja (OSM)
                    </button>
                  )}
                </div>

                {mapId != null && (
                  <div>
                    <label className={LABEL} htmlFor="sel-ver">
                      Versi data NDVI
                    </label>

                    <select
                      id="sel-ver"
                      className={FIELD}
                      value={versionId ?? ""}
                      onChange={(e) =>
                        setVersionId(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      disabled={!detail?.versions.length}
                    >
                      {!detail?.versions.length && (
                        <option value="">Belum ada versi NDVI</option>
                      )}

                      {detail?.versions.map((v) => (
                        <option
                          key={v.id}
                          value={v.id}
                          disabled={v.status !== "ready"}
                        >
                          v{v.version} · {v.label}
                          {v.is_active ? " (aktif)" : ""}
                          {v.status !== "ready"
                            ? ` [${
                                v.status === "processing" ? "diproses" : "gagal"
                              }]`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {gridMsg && <Notice>{gridMsg}</Notice>}

                {mapId != null && summary && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className={TILE}>
                      <div className="text-[11px] text-[#5a5a5a]">
                        Total petak
                      </div>
                      <div className="mt-0.5 text-lg font-bold tabular-nums text-[#202020]">
                        {summary.cells}
                      </div>
                    </div>

                    <div className={TILE}>
                      <div className="text-[11px] text-[#5a5a5a]">
                        Luas terpetakan
                      </div>
                      <div className="mt-0.5 text-lg font-bold tabular-nums text-[#202020]">
                        {fmtHa(summary.area_ha)} ha
                      </div>
                    </div>
                  </div>
                )}

                {mapId != null && grid && (
                  <p className="text-[11px] leading-4 text-[#6b6b6b]">
                    Petak {Math.round(grid.cell_size_m)} m
                    <span className="ml-1 inline-flex" title="Luas nominal 1 ha; petak tepi lahan bisa lebih kecil." aria-label="Luas nominal 1 hektare; petak tepi bisa lebih kecil" tabIndex={0}>
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </p>
                )}

                {user?.role === "admin" && (
                  <Link
                    href="/upload-peta"
                    className={`inline-block ${LINK_BTN}`}
                  >
                    Upload peta baru
                  </Link>
                )}
              </div>
            </StepCard>

            {mode === "petak" ? (
              <>
                {/* Langkah 2: analisis intensitas */}
                <StepCard
                  n={2}
                  title={titles[1]}
                  state={stepState(2)}
                  badge={
                    <span className="rounded bg-[#efefef] px-1.5 py-0.5 text-[10px] font-semibold text-[#5a5a5a]">
                      Opsional
                    </span>
                  }
                >
                  {!ready ? (
                    locked
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {LEVELS.map((k) => {
                          const b = summary?.by_intensity[k];
                          const on = intensity === k;
                          const total = summary?.cells ?? 0;
                          const pct =
                            total && b
                              ? Math.round((b.cells / total) * 100)
                              : 0;

                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setIntensity(on ? null : k)}
                              aria-pressed={on}
                              className={`w-full rounded-md border p-2.5 text-left transition ${FOCUS} ${
                                on
                                  ? "border-[#D71920] bg-[#FDECEC]"
                                  : "border-[#e2e2e2] bg-white hover:border-[#9a9a9a]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-xs font-semibold text-[#202020]">
                                  <span
                                    className="h-2.5 w-2.5 rounded-sm"
                                    style={{ background: LEVEL_COLOR[k] }}
                                  />
                                  {LEVEL_LABEL[k]}
                                </span>

                                <span className="text-[11px] font-semibold tabular-nums text-[#3a3a3a]">
                                  {b?.cells ?? 0} petak{" "}
                                  <span className="font-normal text-[#5a5a5a]">
                                    ({pct}%)
                                  </span>
                                </span>
                              </div>

                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ececec]">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    background: LEVEL_COLOR[k],
                                  }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {intensity && (
                        <div className="mt-3 space-y-2.5 border-t border-[#efefef] pt-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-[#202020]">
                              Saran tindakan
                            </h4>

                            <button
                              type="button"
                              className={LINK_BTN}
                              onClick={() => setIntensity(null)}
                            >
                              Hapus pilihan
                            </button>
                          </div>

                          {!analysis ? (
                            <p className="text-xs text-[#5a5a5a]">
                              Memuat analisis rekomendasi...
                            </p>
                          ) : (
                            <>
                              {!analysis.has_ndvi ? (
                                <Notice>
                                  Belum ada data NDVI. Ini rekomendasi umum
                                  untuk intensitas{" "}
                                  {LEVEL_LABEL[
                                    analysis.intensity
                                  ].toLowerCase()}
                                  .
                                </Notice>
                              ) : (
                                <p className="text-[11px] text-[#3a3a3a]">
                                  <strong>{analysis.cells}</strong> petak ·{" "}
                                  {fmtHa(analysis.area_ha)} ha
                                </p>
                              )}

                              <p className="text-xs leading-5 text-[#3a3a3a]">
                                {analysis.rule.notes}
                              </p>

                              <ul className="divide-y divide-[#efefef] rounded-md border border-[#e2e2e2]">
                                {analysis.rule.actions.map((a) => (
                                  <li key={a.title} className="px-2.5 py-2">
                                    <div className="flex items-baseline justify-between gap-2">
                                      <span className="text-xs font-semibold text-[#202020]">
                                        {a.title}
                                      </span>
                                      <span className="shrink-0 text-[11px] text-[#5a5a5a]">
                                        {a.interval_label}
                                      </span>
                                    </div>

                                    <div className="mt-0.5 text-[11px] text-[#5a5a5a]">
                                      Tindakan {a.type} · intensitas {a.level}
                                    </div>

                                    {a.detail && (
                                      <div className="mt-1 text-xs leading-4 text-[#3a3a3a]">
                                        {a.detail}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>

                              <p className="text-[11px] leading-4 text-[#5a5a5a]">
                                {analysis.disclaimer || disclaimer}
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </StepCard>

                {/* Langkah 3: pilih petak */}
                <StepCard n={3} title={titles[2]} state={stepState(3)}>
                  {!ready ? (
                    locked
                  ) : (
                    <div className="space-y-2.5">
                      {selectedCells.length === 0 ? (
                        <>
                          <p className="flex items-start gap-2 text-xs leading-5 text-[#3a3a3a]">
                            <CursorClick
                              className="mt-0.5 h-4 w-4 shrink-0 text-[#D71920]"
                              aria-hidden="true"
                            />
                            Klik petak untuk memilih; klik lagi untuk batal.
                          </p>

                          {intensity &&
                            analysis?.has_ndvi &&
                            analysis.cells > 0 && (
                              <button
                                type="button"
                                className={`w-full ${BTN_OUTLINE}`}
                                onClick={() =>
                                  setSelected(new Set(analysis.cell_ids))
                                }
                              >
                                Pilih semua {analysis.cells} petak intensitas{" "}
                                {LEVEL_LABEL[analysis.intensity].toLowerCase()}
                              </button>
                            )}
                        </>
                      ) : (
                        <p className="text-xs leading-5 text-[#3a3a3a]">
                          <strong>{selectedCells.length}</strong> petak dipilih
                          · detail ada di kartu Analisis di bawah.
                        </p>
                      )}

                      {selectedCells.length > 0 && (
                        <button
                          type="button"
                          className={LINK_BTN}
                          onClick={() => setSelected(new Set())}
                        >
                          Kosongkan pilihan
                        </button>
                      )}
                    </div>
                  )}
                </StepCard>

                {/* Langkah 4: ekspor */}
                <StepCard n={4} title={titles[3]} state={stepState(4)}>
                  {!ready ? (
                    locked
                  ) : (
                    <>
                      <p className="mb-2.5 text-xs leading-5 text-[#3a3a3a]">
                        {selectedIds.length ? `${selectedIds.length} petak dipilih` : "Semua petak"}
                      </p>

                      <ExportBar
                        hrefFor={cellsHref}
                        optionLabel="Pisahkan file per petak (ZIP)"
                        disabled={!grid}
                      />
                    </>
                  )}
                </StepCard>
              </>
            ) : (
              <>
                {/* Langkah 2: gambar polygon */}
                <StepCard n={2} title={titles[1]} state={stepState(2)}>
                  {!ready ? (
                    locked
                  ) : pending ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        savePolygon();
                      }}
                      className="space-y-3"
                    >
                      <p className="text-xs leading-5 text-[#3a3a3a]">
                        Polygon selesai digambar, ± {fmtHa(draftHa)} ha. Beri
                        nama untuk menyimpan.
                      </p>
                      {pendingAnalysis && (
                        <p className="text-[11px] leading-4 text-[#6b6b6b]">
                          Hasil masking:{" "}
                          {pendingAnalysis.hits.length
                            ? `${
                                pendingAnalysis.hits.length
                              } petak 1 ha, ${fmtHa(
                                pendingAnalysis.area_ha
                              )} ha. Bagian di luar petak dipotong otomatis.`
                            : "polygon di luar area NDVI, tidak ada petak yang tercakup."}
                        </p>
                      )}

                      <div>
                        <label className={LABEL} htmlFor="pname">
                          Nama polygon
                        </label>

                        <input
                          id="pname"
                          className={FIELD}
                          value={polyName}
                          onChange={(e) => setPolyName(e.target.value)}
                          placeholder="Contoh: Target semprot blok A"
                          required
                          maxLength={120}
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className={`flex-1 ${BTN_RED}`}
                          disabled={!polyName.trim() || saving}
                        >
                          {saving ? "Menyimpan..." : "Simpan polygon"}
                        </button>

                        <button
                          type="button"
                          className={BTN_OUTLINE}
                          onClick={cancelDraw}
                          disabled={saving}
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : drawing ? (
                    <div className="space-y-2">
                      <p className="text-xs leading-5 text-[#3a3a3a]">
                        Klik pada peta untuk menambahkan titik sudut. Minimal
                        tiga titik untuk menyelesaikan polygon.
                      </p>

                      <div className={`${TILE} text-xs font-semibold`}>
                        {draft.length} titik ·{" "}
                        {draft.length >= 3
                          ? `${fmtHa(draftHa)} ha`
                          : "Belum membentuk area"}
                      </div>

                      <button
                        type="button"
                        className={`w-full ${BTN_OUTLINE}`}
                        onClick={cancelDraw}
                      >
                        Batalkan digitasi
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-3 text-xs leading-5 text-[#3a3a3a]">
                        Gambar area target penyemprotan atau area kerja, lalu
                        simpan dan ekspor.
                      </p>

                      <button
                        type="button"
                        className={`w-full py-2.5 ${BTN_RED}`}
                        onClick={startDraw}
                      >
                        <PencilRuler className="h-4 w-4" aria-hidden="true" />
                        Gambar polygon baru
                      </button>
                    </div>
                  )}
                </StepCard>

                {/* Langkah 3: pilih polygon */}
                <StepCard
                  n={3}
                  title={titles[2]}
                  state={stepState(3)}
                  badge={
                    ready ? (
                      <span className="rounded bg-[#efefef] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#202020]">
                        {polygons.length}
                      </span>
                    ) : undefined
                  }
                >
                  {!ready ? (
                    locked
                  ) : polygons.length === 0 ? (
                    <p className="text-xs leading-5 text-[#5a5a5a]">
                      Belum ada polygon tersimpan. Gambar polygon pertama pada
                      langkah 2.
                    </p>
                  ) : (
                    <>
                      <label className="relative mb-2 block">
                        <span className="sr-only">Cari polygon</span>
                        <MagnifyingGlass
                          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6b6b]"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={polyQ}
                          onChange={(e) => setPolyQ(e.target.value)}
                          placeholder="Cari nama atau pemilik polygon"
                          className={`h-9 w-full rounded-md border border-[#cfcfcf] bg-white pl-8 pr-2.5 text-xs text-[#202020] placeholder:text-[#9a9a9a] ${FOCUS}`}
                        />
                      </label>
                      {pq && (
                        <p className="mb-2 text-[11px] text-[#6b6b6b]">
                          {polygonsShown.length} dari {polygons.length} polygon
                        </p>
                      )}
                      {polygonsShown.length === 0 && (
                        <p className="text-xs leading-5 text-[#6b6b6b]">
                          Tidak ada polygon yang cocok dengan pencarian.
                        </p>
                      )}
                      <ul className="space-y-2">
                        {polygonsShown.map((p) => (
                          <li
                            key={p.id}
                            className={`rounded-md border p-2.5 ${
                              selPoly === p.id
                                ? "border-[#D71920] bg-[#FDECEC]"
                                : "border-[#e2e2e2] bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                className={`min-w-0 rounded text-left ${FOCUS}`}
                                onClick={() => {
                                  setSelPoly(p.id);
                                  setFit((f) => ({
                                    key: f.key + 1,
                                    bounds: boundsOf(p.geometry),
                                  }));
                                }}
                              >
                                <span className="block truncate text-xs font-semibold text-[#202020]">
                                  {p.name}
                                </span>

                                <span className="mt-0.5 block text-[11px] text-[#5a5a5a]">
                                  {fmtHa(p.area_ha)} ha
                                  {p.owner && ` · ${p.owner}`}
                                </span>
                              </button>

                              {confirmDel !== p.id && (
                                <button
                                  type="button"
                                  className={`rounded-md p-1.5 text-[#A3121A] transition hover:bg-[#FDECEC] ${FOCUS}`}
                                  aria-label={`Hapus ${p.name}`}
                                  onClick={() => setConfirmDel(p.id)}
                                >
                                  <Trash className="h-4 w-4" />
                                </button>
                              )}
                            </div>

                            {p.coverage_pct != null &&
                              p.coverage_pct < 99.5 && (
                                <div className="mt-2 text-[11px] text-[#A3121A]">
                                  {Math.round(100 - p.coverage_pct)}% area
                                  berada di luar batas lahan.
                                </div>
                              )}

                            {selPoly === p.id && confirmDel !== p.id && (
                              <div className="mt-2 flex items-center gap-2 border-t border-[#efefef] pt-2">
                                {editId === p.id ? (
                                  <span className="text-[11px] text-[#D71920]">
                                    Sedang mengedit. Gunakan toolbar di peta.
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className={`${BTN_OUTLINE} flex-1`}
                                    onClick={() => startEdit(p)}
                                    disabled={
                                      p.geometry.type !== "Polygon" ||
                                      drawing ||
                                      pending
                                    }
                                    title={
                                      p.geometry.type !== "Polygon"
                                        ? "Hanya polygon tunggal yang bisa diedit"
                                        : "Edit titik sudut polygon"
                                    }
                                  >
                                    <PencilSimple
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                    Edit bentuk garis
                                  </button>
                                )}
                              </div>
                            )}

                            {confirmDel === p.id && (
                              <div className="mt-2.5 flex items-center gap-2 border-t border-[#efefef] pt-2.5">
                                <span className="flex-1 text-xs font-semibold text-[#202020]">
                                  Hapus polygon ini?
                                </span>

                                <button
                                  type="button"
                                  className={`${BTN_RED} px-2.5 py-1.5`}
                                  onClick={() => removePolygon(p)}
                                >
                                  Ya, hapus
                                </button>

                                <button
                                  type="button"
                                  className={`${BTN_OUTLINE} px-2.5 py-1.5`}
                                  onClick={() => setConfirmDel(null)}
                                >
                                  Batal
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </StepCard>

                {/* Langkah 4: ekspor */}
                <StepCard n={4} title={titles[3]} state={stepState(4)}>
                  {!ready ? (
                    locked
                  ) : !selectedPolygon ? (
                    <p className="text-xs leading-5 text-[#5a5a5a]">
                      Pilih satu polygon pada langkah 3 untuk mengekspornya.
                    </p>
                  ) : (
                    <>
                      <p className="mb-2.5 text-xs leading-5 text-[#3a3a3a]">
                        Ekspor <strong>{selectedPolygon.name}</strong>.
                      </p>

                      <button
                        type="button"
                        className={`w-full ${BTN_RED}`}
                        disabled={
                          editId === selectedPolygon.id ||
                          !selectedAnalysis ||
                          selectedAnalysis.hits.length === 0
                        }
                        onClick={() =>
                          selectedAnalysis &&
                          exportPolygonKml(
                            selectedPolygon,
                            selectedAnalysis,
                            rules,
                            version
                              ? `v${version.version} · ${version.label}`
                              : undefined
                          )
                        }
                      >
                        <DownloadSimple
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Unduh KML (hasil masking)
                      </button>
                      <p className="mt-2 text-[11px] leading-4 text-[#6b6b6b]">
                        Bentuk dipotong tepat pada petak yang dicakup, lengkap
                        dengan warna dan analisis tiap petak.
                      </p>
                    </>
                  )}
                </StepCard>
              </>
            )}
          </div>
          {mode === "custom" && <AnalysisCard
            mode={mode}
            cells={selectedCells}
            polygon={selectedPolygon}
            polyAnalysis={selectedAnalysis}
            hasGrid={!!grid}
            cellSizeM={grid?.cell_size_m}
            rules={rules}
            open={analysisOpen}
            onToggle={() => setAnalysisOpen((o) => !o)}
            surveyLabel={
              version ? `v${version.version} · ${version.label}` : undefined
            }
          />}
        </aside>

        <button
          type="button"
          onClick={() => {
            setPanelOpen(true);
            if (isMobile()) setSurveyOpen(false);
          }}
          aria-label="Buka panel alur kerja"
          title="Buka panel alur kerja"
          tabIndex={panelOpen ? -1 : 0}
          className={`absolute left-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-md border border-[#e6e6e6] bg-white shadow-[0_4px_16px_rgba(32,32,32,0.12)] transition-[transform,opacity,visibility] duration-[380ms] ease-apple hover:text-[#D71920] ${FOCUS} ${
            panelOpen
              ? "pointer-events-none invisible scale-75 opacity-0"
              : "visible scale-100 opacity-100"
          }`}
        >
          <SidebarSimple className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        {/* Laci peta survey */}
        <aside
          aria-label="Peta survey"
          aria-hidden={!surveyOpen}
          className={`absolute bottom-0 right-0 top-0 z-30 flex w-[min(320px,86vw)] flex-col border-l border-[#e6e6e6] bg-white transition-[transform,visibility,box-shadow] duration-[420ms] ease-apple ${
            surveyOpen
              ? "visible translate-x-0 shadow-[-8px_0_28px_rgba(32,32,32,0.10)]"
              : "invisible translate-x-full"
          }`}
        >
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#e6e6e6] px-3">
            <h2 className="text-[13px] font-semibold text-[#202020]">
              Peta survey
            </h2>
            <button
              type="button"
              onClick={() => setSurveyOpen(false)}
              aria-label="Tutup laci peta survey"
              className={`grid h-7 w-7 place-items-center rounded-md text-[#5a5a5a] transition hover:text-[#D71920] ${FOCUS}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="shrink-0 border-b border-[#ececec] p-2.5">
            <label className="relative block">
              <span className="sr-only">Cari survey</span>
              <MagnifyingGlass
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6b6b]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={surveyQ}
                onChange={(e) => setSurveyQ(e.target.value)}
                placeholder="Cari survey, bulan, atau catatan"
                className={`h-9 w-full rounded-md border border-[#cfcfcf] bg-white pl-8 pr-2.5 text-xs text-[#202020] placeholder:text-[#9a9a9a] ${FOCUS}`}
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {mapId == null ? (
              <p className="p-3 text-xs leading-5 text-[#6b6b6b]">
                Pilih peta pada panel Alur kerja untuk melihat riwayat survey.
              </p>
            ) : surveyList.length === 0 ? (
              <p className="p-3 text-xs leading-5 text-[#6b6b6b]">
                Belum ada survey untuk peta ini.
              </p>
            ) : surveyShown.length === 0 ? (
              <p className="p-3 text-xs leading-5 text-[#6b6b6b]">
                Tidak ada survey yang cocok dengan pencarian.
              </p>
            ) : (
              surveyGroups.map(([month, items]) => (
                <section key={month} className="border-b border-[#ececec] p-3">
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#6b6b6b]">
                    {month}
                    {month === thisMonth && (
                      <span className="rounded bg-[#FDECEC] px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-[#D71920]">
                        Bulan ini
                      </span>
                    )}
                  </h3>

                  <ul className="space-y-2">
                    {items.map((v) => {
                      const on = v.id === versionId;
                      const ok = v.status === "ready";
                      return (
                        <li key={v.id}>
                          <button
                            type="button"
                            disabled={!ok}
                            onClick={() => setVersionId(v.id)}
                            aria-pressed={on}
                            className={`flex w-full gap-2.5 rounded-md border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS} ${
                              on
                                ? "border-[#D71920] bg-[#FDECEC]"
                                : "border-[#e2e2e2] bg-white hover:border-[#D71920]"
                            }`}
                          >
                            <SurveyThumb
                              url={
                                ok && v.has_tiles
                                  ? `${window.location.origin}/api/maps/${mapId}/versions/${v.id}/tiles.pmtiles`
                                  : null
                              }
                              bounds={v.bounds}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 truncate text-xs font-semibold text-[#202020]">
                                  {v.label}
                                </span>
                                <span className="shrink-0 text-[11px] tabular-nums text-[#6b6b6b]">
                                  v{v.version}
                                </span>
                              </div>

                              <div className="mt-1 text-[11px] text-[#6b6b6b]">
                                {new Date(v.created_at).toLocaleDateString(
                                  "id-ID",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )}
                                {v.stats &&
                                  ` · NDVI rata-rata ${fmtNdvi(v.stats.mean)}`}
                              </div>

                              {(v.is_active || !ok) && (
                                <div className="mt-1.5 flex gap-1.5">
                                  {v.is_active && (
                                    <span className="rounded bg-[#202020] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                      Aktif
                                    </span>
                                  )}
                                  {!ok && (
                                    <span className="rounded bg-[#efefef] px-1.5 py-0.5 text-[10px] font-semibold text-[#5a5a5a]">
                                      {v.status === "processing"
                                        ? "Diproses"
                                        : "Gagal"}
                                    </span>
                                  )}
                                </div>
                              )}

                              {v.notes && (
                                <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-[#3a3a3a]">
                                  {v.notes}
                                </p>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}

            {user?.role === "admin" && (
              <div className="p-3">
                <Link
                  href="/upload-peta"
                  className={`inline-block ${LINK_BTN}`}
                >
                  Unggah survey baru
                </Link>
              </div>
            )}
          </div>
        </aside>

        {/* Toolbar bawah, seperti toolbar Figma */}
        <div
          className={`pointer-events-none absolute bottom-0 left-1/2 z-[25] -translate-x-1/2 transition-[left] duration-[420ms] ease-apple ${shift}`}
        >
          <div
            className="pointer-events-auto flex flex-col items-center transition-transform duration-[420ms] ease-apple"
            style={{
              transform: toolsOpen
                ? "translateY(0)"
                : "translateY(calc(100% - 24px))",
            }}
          >
            <button
              type="button"
              onClick={toggleTools}
              aria-expanded={toolsOpen}
              aria-controls="map-tools"
              title={
                toolsOpen ? "Sembunyikan alat" : "Tarik ke atas untuk alat peta"
              }
              className={`flex h-6 items-center gap-1.5 rounded-t-lg border border-b-0 border-[#e6e6e6] bg-white px-3 text-[10px] font-semibold text-[#202020] transition-colors hover:text-[#D71920] ${FOCUS}`}
            >
              Alat peta
              <CaretDown
                weight="bold"
                className={`h-3 w-3 transition-transform duration-[420ms] ease-apple ${
                  toolsOpen ? "" : "rotate-180"
                }`}
              />
            </button>
            <div
              id="map-tools"
              className="mb-3 flex items-center gap-1 rounded-xl border border-[#e6e6e6] bg-white p-1 shadow-[0_8px_28px_rgba(32,32,32,0.16)]"
              role="toolbar"
              aria-label="Alat peta"
            >
              {MODES.map(([m, label]) => {
                const Icon = m === "petak" ? GridFour : PencilRuler;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    aria-pressed={mode === m}
                    title={label}
                    className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${FOCUS} ${
                      mode === m
                        ? "bg-[#D71920] text-white"
                        : "text-[#202020] hover:text-[#D71920]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}

              <span className="mx-1 h-5 w-px bg-[#e6e6e6]" aria-hidden="true" />

              <button
                type="button"
                onClick={() => {
                  setLayersOpen((o) => !o);
                  setSurveyOpen(false);
                }}
                aria-expanded={layersOpen}
                title="Layer dan legenda"
                className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${FOCUS} ${
                  layersOpen
                    ? "bg-[#FDECEC] text-[#D71920]"
                    : "text-[#202020] hover:text-[#D71920]"
                }`}
              >
                <Stack className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="hidden sm:inline">Layer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!surveyOpen && isMobile()) setPanelOpen(false);
                  setSurveyOpen((o) => !o);
                  setLayersOpen(false);
                }}
                aria-expanded={surveyOpen}
                title="Peta survey"
                className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${FOCUS} ${
                  surveyOpen
                    ? "bg-[#FDECEC] text-[#D71920]"
                    : "text-[#202020] hover:text-[#D71920]"
                }`}
              >
                <CalendarBlank
                  className="h-[18px] w-[18px]"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Survey</span>
              </button>
            </div>
          </div>
        </div>

        <section
          aria-hidden={!layersOpen}
          className={`absolute left-1/2 z-[26] max-h-[58vh] w-[min(260px,calc(100%-24px))] -translate-x-1/2 origin-bottom overflow-y-auto rounded-lg border border-[#e6e6e6] bg-white p-3 shadow-[0_8px_28px_rgba(32,32,32,0.16)] transition-[transform,opacity,visibility,left,bottom] duration-[380ms] ease-apple ${shift} ${
            toolsOpen ? "bottom-[104px]" : "bottom-10"
          } ${
            layersOpen
              ? "visible translate-y-0 scale-100 opacity-100"
              : "pointer-events-none invisible translate-y-4 scale-95 opacity-0"
          }`}
          aria-label="Layer dan legenda"
        >
          <h2 className="mb-2 text-xs font-bold text-[#202020]">Layer peta</h2>
          <div
            className={`mb-1.5 grid gap-0.5 rounded-md bg-[#f0f0f0] p-0.5 ${
              BASEMAPS.length > 2 ? "grid-cols-3" : "grid-cols-2"
            }`}
            role="group"
            aria-label="Peta dasar"
          >
            {BASEMAPS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBasemap(k)}
                aria-pressed={basemap === k}
                className={`h-7 rounded text-xs font-semibold transition ${FOCUS} ${
                  basemap === k
                    ? "bg-white text-[#D71920] shadow-sm"
                    : "text-[#202020] hover:text-[#D71920]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {basemap === "satellite" && (
            <p className="mb-2 text-[10px] leading-4 text-[#6b6b6b]">
              Citra Esri. Di zoom sangat dekat gambar diperbesar dari tile
              terakhir yang tersedia.
            </p>
          )}

          <div className="space-y-0.5">
            {LAYER_ITEMS.map(([k, label, desc]) => (
              <label
                key={k}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 transition hover:bg-[#f4f4f4]"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[#202020]">
                    {label}
                  </span>
                  <span className="block text-[11px] text-[#5a5a5a]">
                    {desc}
                  </span>
                </span>

                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#D71920]"
                  checked={layers[k]}
                  onChange={(e) =>
                    setLayers({
                      ...layers,
                      [k]: e.target.checked,
                    })
                  }
                />
              </label>
            ))}
          </div>

          <div className="mt-2 border-t border-[#efefef] px-2 pt-2.5">
            <label
              htmlFor="ndvi-opacity"
              className="flex items-center justify-between text-xs font-semibold text-[#202020]"
            >
              Opacity raster TIFF
              <span className="tabular-nums text-[11px] font-normal text-[#6b6b6b]">
                {Math.round(rasterOpacity * 100)}%
              </span>
            </label>
            <input
              id="ndvi-opacity"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(rasterOpacity * 100)}
              onChange={(e) => setRasterOpacity(Number(e.target.value) / 100)}
              disabled={!layers.ndvi}
              className="mt-1.5 h-1.5 w-full cursor-pointer accent-[#D71920] disabled:opacity-40"
            />
          </div>

          <h2 className="mb-2 mt-3 border-t border-[#efefef] pt-3 text-xs font-bold text-[#202020]">
            Legenda intensitas
          </h2>

          <div className="space-y-2">
            {LEVELS.map((k) => (
              <div
                key={k}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2 text-[#3a3a3a]">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ background: LEVEL_COLOR[k] }}
                  />
                  {LEVEL_LABEL[k]}
                </span>

                <span className="tabular-nums text-[11px] text-[#5a5a5a]">
                  {summary?.by_intensity[k]?.cells ?? 0} petak
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Edit vektor polygon */}
        {mode === "custom" && editId != null && (
          <ActionBar
            bottom={toolsOpen ? "bottom-[104px]" : "bottom-10"}
            shift={shift}
            info={`${editRing.length} titik · ± ${fmtHa(
              polygonAreaHa(editRing)
            )} ha`}
            hint="Seret pin · klik titik kecil untuk menambah · klik kanan pin untuk menghapus"
          >
            <button
              type="button"
              className={`h-8 flex-1 rounded-md bg-[#D71920] px-3 text-xs font-semibold text-white transition hover:bg-[#B8141A] disabled:opacity-40 ${FOCUS}`}
              onClick={saveEdit}
              disabled={saving || editRing.length < 3}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              className={`h-8 flex-1 rounded-md border border-[#d4d4d4] px-3 text-xs transition hover:text-[#D71920] ${FOCUS}`}
              onClick={cancelEdit}
              disabled={saving}
              title="Batal (Esc)"
            >
              Batal
            </button>
          </ActionBar>
        )}

        {/* Drawing controls */}
        {mode === "custom" && drawing && (
          <ActionBar
            bottom={toolsOpen ? "bottom-[104px]" : "bottom-10"}
            shift={shift}
            info={`${draft.length} titik${
              draft.length >= 3 ? ` · ± ${fmtHa(draftHa)} ha` : ""
            }`}
            hint="Klik peta untuk menambah titik"
          >
            <button
              type="button"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#d4d4d4] transition hover:bg-[#f4f4f4] disabled:opacity-40 ${FOCUS}`}
              disabled={!draft.length}
              onClick={undoPoint}
              title="Hapus titik terakhir (Backspace)"
              aria-label="Hapus titik terakhir"
            >
              <ArrowUUpLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`h-8 flex-1 rounded-md bg-[#D71920] px-3 text-xs font-semibold text-white transition hover:bg-[#B8141A] disabled:opacity-40 ${FOCUS}`}
              disabled={draft.length < 3}
              onClick={finishDraw}
              title="Selesai (Enter)"
            >
              Selesai
            </button>
            <button
              type="button"
              className={`h-8 flex-1 rounded-md border border-[#d4d4d4] px-3 text-xs transition hover:bg-[#f4f4f4] ${FOCUS}`}
              onClick={cancelDraw}
              title="Batal (Esc)"
            >
              Batal
            </button>
          </ActionBar>
        )}
      </div>
    </IconContext.Provider>
  );
}
