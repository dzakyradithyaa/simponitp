"use client";

import { Download, Layers, MousePointerClick, PencilRuler, Trash2, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IntensityBadge, LEVEL_COLOR, LEVEL_LABEL, Notice, Spinner } from "@/components/ui";
import type { LayerToggles } from "@/components/MapCanvas";
import { api, fmtHa, fmtNdvi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { boundsOf, polygonAreaHa } from "@/lib/geo";
import type { Analysis, Bounds, GridCollection, Intensity, MapItem, PolygonItem, Position, Rule } from "@/lib/types";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center"><Spinner label="Memuat peta..." /></div> });
const LEVELS: Intensity[] = ["rendah", "sedang", "tinggi"];

function ExportBar({ hrefFor, optionLabel, disabled }: { hrefFor: (fmt: "kml" | "kmz", opt: boolean) => string; optionLabel: string; disabled?: boolean }) {
  const [opt, setOpt] = useState(false);
  const cls = (off?: boolean) => `btn-gold flex-1 ${off ? "pointer-events-none opacity-50" : ""}`;
  return (
    <div>
      <div className="flex gap-2">
        <a className={cls(disabled)} href={hrefFor("kml", opt)} aria-disabled={disabled}><Download className="h-4 w-4" aria-hidden /> KML</a>
        <a className={cls(disabled)} href={hrefFor("kmz", opt)} aria-disabled={disabled}><Download className="h-4 w-4" aria-hidden /> KMZ</a>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-army-800">
        <input type="checkbox" className="h-4 w-4 accent-army-700" checked={opt} onChange={(e) => setOpt(e.target.checked)} /> {optionLabel}
      </label>
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
  const [mode, setMode] = useState<"petak" | "custom">("petak");
  const [layers, setLayers] = useState<LayerToggles>({ boundary: true, grid: true, ndvi: true, polygons: true });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [draft, setDraft] = useState<Position[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [pending, setPending] = useState(false);
  const [polyName, setPolyName] = useState("");
  const [selPoly, setSelPoly] = useState<number | null>(null);
  const [fit, setFit] = useState<{ key: number; bounds: Bounds | null }>({ key: 0, bounds: null });
  const [error, setError] = useState<string | null>(null);
  const [gridMsg, setGridMsg] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState("");

  // initial data
  useEffect(() => {
    Promise.all([api.get<MapItem[]>("/maps"), api.get<{ rules: Rule[]; disclaimer: string }>("/recommendations/rules")])
      .then(([m, r]) => {
        setMaps(m); setRules(r.rules); setDisclaimer(r.disclaimer);
        const wanted = Number(new URLSearchParams(window.location.search).get("map"));
        setMapId((m.find((x) => x.id === wanted) ?? m.find((x) => x.has_boundary) ?? m[0])?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  // map changed: load detail + polygons
  useEffect(() => {
    setSelected(new Set()); setIntensity(null); setAnalysis(null); setSelPoly(null); setDraft([]); setDrawing(false); setPending(false);
    if (mapId == null) { // base map only: nothing uploaded, or the user chose to hide uploaded maps
      setDetail(null); setPolygons([]); setVersionId(null); setGrid(null); setGridMsg(null);
      return;
    }
    Promise.all([api.get<MapItem>(`/maps/${mapId}`), api.get<PolygonItem[]>(`/maps/${mapId}/polygons`)])
      .then(([d, p]) => {
        setDetail(d); setPolygons(p);
        const ready = d.versions.filter((v) => v.status === "ready");
        setVersionId((ready.find((v) => v.is_active) ?? ready[ready.length - 1])?.id ?? null);
        setFit((f) => ({ key: f.key + 1, bounds: d.bounds }));
      })
      .catch((e) => setError(e.message));
  }, [mapId]);

  // grid for map + version
  useEffect(() => {
    if (mapId == null || !detail || detail.id !== mapId) return;
    if (!detail.has_boundary) { setGrid(null); setGridMsg("Peta ini belum memiliki TIFF. Unggah TIFF di Upload Peta."); return; }
    api.get<GridCollection>(`/maps/${mapId}/grid${versionId ? `?version_id=${versionId}` : ""}`)
      .then((g) => { setGrid(g); setGridMsg(null); })
      .catch((e) => { setGrid(null); setGridMsg(e.message); });
  }, [mapId, versionId, detail]);

  // recommendation analysis for the chosen intensity
  useEffect(() => {
    if (!intensity || mapId == null || !grid) return setAnalysis(null);
    api.get<Analysis>(`/recommendations/analysis?map_id=${mapId}&intensity=${intensity}${versionId ? `&version_id=${versionId}` : ""}`)
      .then(setAnalysis).catch((e) => setError(e.message));
  }, [intensity, mapId, versionId, grid]);

  const version = detail?.versions.find((v) => v.id === versionId) ?? null;
  const tilesUrl = version && version.status === "ready" && version.has_tiles && typeof window !== "undefined"
    ? `${window.location.origin}/api/maps/${mapId}/versions/${version.id}/tiles.pmtiles` : null;
  const ruleOf = (k: Intensity | null) => rules.find((r) => r.intensity === k);
  const selectedCells = useMemo(() => (grid?.features ?? []).filter((f) => selected.has(f.properties.cell_id)).map((f) => f.properties), [grid, selected]);

  const toggleCell = useCallback((id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const addPoint = useCallback((p: Position) => setDraft((d) => [...d, p]), []);
  const pickPolygon = useCallback((id: number) => setSelPoly(id), []);

  const cellsHref = (fmt: "kml" | "kmz", separate: boolean) => {
    const q = new URLSearchParams({ map_id: String(mapId), format: fmt });
    if (versionId) q.set("version_id", String(versionId));
    if (selected.size) q.set("cell_ids", [...selected].join(","));
    if (separate) q.set("separate", "true");
    return `/api/exports/cells?${q}`;
  };

  async function savePolygon() {
    setError(null);
    try {
      const created = await api.post<PolygonItem>(`/maps/${mapId}/polygons`, { name: polyName.trim(), geometry: { type: "Polygon", coordinates: [[...draft, draft[0]]] } });
      setPolygons((p) => [created, ...p]); setSelPoly(created.id);
      setDraft([]); setPending(false); setPolyName("");
    } catch (e) { setError((e as Error).message); }
  }
  async function removePolygon(p: PolygonItem) {
    if (!confirm(`Hapus polygon "${p.name}"?`)) return;
    await api.del(`/polygons/${p.id}`).catch((e) => setError(e.message));
    setPolygons((l) => l.filter((x) => x.id !== p.id));
    if (selPoly === p.id) setSelPoly(null);
  }
  const cancelDraw = () => { setDraft([]); setDrawing(false); setPending(false); };

  if (error && !maps) return <Notice kind="error">{error}</Notice>;
  if (!maps) return <Spinner />;

  const draftHa = polygonAreaHa(draft);
  const summary = grid?.summary;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col lg:h-[calc(100vh-3rem)]">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="mr-2">Peta Saya</h1>
        <label className="sr-only" htmlFor="sel-map">Peta</label>
        <select id="sel-map" className="input w-auto" value={mapId ?? ""} onChange={(e) => setMapId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Hanya peta dasar (OpenStreetMap)</option>
          {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {mapId != null && <label className="sr-only" htmlFor="sel-ver">Versi peta</label>}
        {mapId != null && <select id="sel-ver" className="input w-auto" value={versionId ?? ""} onChange={(e) => setVersionId(e.target.value ? Number(e.target.value) : null)} disabled={!detail?.versions.length}>
          {!detail?.versions.length && <option value="">Belum ada versi NDVI</option>}
          {detail?.versions.map((v) => (
            <option key={v.id} value={v.id} disabled={v.status !== "ready"}>
              v{v.version} · {v.label}{v.is_active ? " (aktif)" : ""}{v.status !== "ready" ? ` [${v.status === "processing" ? "diproses" : "gagal"}]` : ""}
            </option>
          ))}
        </select>}
        {summary && <span className="text-sm text-army-700">{summary.cells} petak · {fmtHa(summary.area_ha)} ha</span>}
      </div>

      {error && <div className="mb-3"><Notice kind="error">{error}</Notice></div>}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_360px]">
        {/* ---------- map ---------- */}
        <div className="card relative min-h-[420px] overflow-hidden">
          <MapCanvas
            layers={layers} boundary={detail?.boundary ?? null} grid={grid} selected={selected}
            highlight={mode === "petak" ? intensity : null} tilesUrl={tilesUrl}
            polygons={polygons} selectedPolygonId={selPoly} mode={mode} drawing={drawing} draft={draft} fit={fit}
            onCellClick={toggleCell} onPolygonClick={pickPolygon} onDrawPoint={addPoint}
          />

          <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded border border-army-700 bg-army-900 shadow" role="group" aria-label="Mode peta">
            {([["petak", "Lihat petak"], ["custom", "Custom petak"]] as const).map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); if (m === "petak") cancelDraw(); }} aria-pressed={mode === m}
                      className={`whitespace-nowrap px-3 py-2 text-sm font-semibold sm:px-4 ${mode === m ? "bg-gold-500 text-army-950" : "text-khaki-100 hover:bg-army-800"}`}>{label}</button>
            ))}
          </div>

          <details className="absolute right-3 top-3 z-10 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded border border-army-300 bg-white/95 px-3 py-2 font-semibold text-army-900 shadow" aria-label="Layer"><Layers className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Layer</span></summary>
            <div className="absolute right-0 mt-1 w-44 space-y-1 rounded border border-army-300 bg-white/95 px-3 py-2 shadow">
              {([["boundary", "Batas lahan"], ["grid", "Petak 1 ha"], ["ndvi", "Peta TIFF"], ["polygons", "Polygon custom"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" className="accent-army-700" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {label}</label>
              ))}
            </div>
          </details>

          {gridMsg && <div className="absolute inset-x-3 bottom-12 z-10"><Notice>{gridMsg}</Notice></div>}
          {mode === "custom" && drawing && (
            <div className="absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded bg-army-900/95 px-3 py-2 text-sm text-khaki-100 shadow">
              <span>{draft.length} titik{draft.length >= 3 && ` · ± ${fmtHa(draftHa)} ha`}</span>
              <button className="btn border border-army-600 px-2 py-1 text-khaki-100 hover:bg-army-800" disabled={!draft.length} onClick={() => setDraft((d) => d.slice(0, -1))}><Undo2 className="h-4 w-4" aria-label="Hapus titik terakhir" /></button>
              <button className="btn-gold px-2.5 py-1" disabled={draft.length < 3} onClick={() => { setDrawing(false); setPending(true); }}>Selesai</button>
              <button className="btn border border-army-600 px-2 py-1 text-khaki-100 hover:bg-army-800" onClick={cancelDraw}>Batal</button>
            </div>
          )}
        </div>

        {/* ---------- side panel ---------- */}
        <aside className="min-h-0 space-y-3 overflow-y-auto pb-2" aria-label="Panel petak">
          {mapId == null ? (
            <section className="card p-4" aria-labelledby="nomap">
              <h2 id="nomap" className="mb-1">{maps.length ? "Hanya peta dasar" : "Belum ada peta TIFF"}</h2>
              <p className="text-sm text-army-800">
                Ini peta dasar OpenStreetMap. Geser dan zoom untuk menjelajah.{" "}
                {maps.length
                  ? "Pilih peta di atas untuk menampilkan TIFF, petak 1 ha, dan rekomendasi."
                  : "Setelah admin mengunggah TIFF, peta hasil unggahan muncul di atas peta dasar sesuai koordinatnya, lengkap dengan petak dan rekomendasi."}
                {mode === "custom" && " Polygon custom disimpan pada sebuah peta, jadi pilih atau unggah peta dulu."}
              </p>
              {user?.role === "admin" && <Link href="/upload-peta" className="btn-gold mt-3">Upload peta (TIFF)</Link>}
            </section>
          ) : mode === "petak" ? (
            <>
              <section className="card p-4" aria-labelledby="rek">
                <h2 id="rek" className="mb-1">Analisis rekomendasi</h2>
                <p className="mb-3 text-sm text-army-700">Pilih intensitas untuk melihat tindakan yang disarankan.</p>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pilih intensitas">
                  {LEVELS.map((k) => {
                    const b = summary?.by_intensity[k];
                    const on = intensity === k;
                    return (
                      <button key={k} onClick={() => setIntensity(on ? null : k)} aria-pressed={on}
                              className={`rounded border-2 px-2 py-2 text-left ${on ? "bg-white" : "bg-army-50 hover:bg-white"}`} style={{ borderColor: on ? LEVEL_COLOR[k] : "transparent" }}>
                        <span className="flex items-center gap-1.5 text-sm font-semibold"><span className="h-3 w-3 rounded-sm" style={{ background: LEVEL_COLOR[k] }} />{LEVEL_LABEL[k]}</span>
                        <span className="text-xs text-army-700">{b ? `${b.cells} petak` : "-"}</span>
                      </button>
                    );
                  })}
                </div>

                {analysis && (
                  <div className="mt-3 space-y-2">
                    {!analysis.has_ndvi && <Notice>Belum ada data NDVI. Ini rekomendasi umum untuk intensitas {LEVEL_LABEL[analysis.intensity].toLowerCase()}.</Notice>}
                    {analysis.has_ndvi && (
                      <div className="flex items-center justify-between text-sm">
                        <span><strong>{analysis.cells}</strong> petak · {fmtHa(analysis.area_ha)} ha</span>
                        <button className="font-semibold text-army-700 underline disabled:no-underline disabled:opacity-40" disabled={!analysis.cells} onClick={() => setSelected(new Set(analysis.cell_ids))}>Pilih semuanya</button>
                      </div>
                    )}
                    <p className="text-sm text-army-800">{analysis.rule.notes}</p>
                    <ul className="divide-y divide-army-200 rounded border border-army-200 bg-white">
                      {analysis.rule.actions.map((a) => (
                        <li key={a.title} className="px-3 py-2">
                          <div className="flex items-baseline justify-between gap-2"><span className="font-semibold">{a.title}</span><span className="shrink-0 text-xs font-medium text-army-700">{a.interval_label}</span></div>
                          <div className="text-xs text-army-600">Tindakan {a.type} · intensitas {a.level}</div>
                          {a.detail && <div className="mt-0.5 text-sm text-army-800">{a.detail}</div>}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-army-600">{analysis.disclaimer || disclaimer}</p>
                  </div>
                )}
              </section>

              <section className="card p-4" aria-labelledby="pilih">
                <h2 id="pilih" className="mb-2">Petak dipilih</h2>
                {selectedCells.length === 0 ? (
                  <p className="flex items-start gap-2 text-sm text-army-700"><MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Klik petak di peta untuk memilih. Tanpa pilihan, ekspor mencakup semua petak.</p>
                ) : selectedCells.length === 1 ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between"><span className="font-display text-xl font-semibold">{selectedCells[0].cell_id}</span><IntensityBadge intensity={selectedCells[0].intensity} /></div>
                    <div>Luas: <strong>{fmtHa(selectedCells[0].area_ha)} ha</strong>{!selectedCells[0].is_full && " (petak tepi)"}</div>
                    <div>NDVI rata-rata: <strong>{fmtNdvi(selectedCells[0].ndvi_mean)}</strong>{selectedCells[0].ndvi_min != null && <span className="text-army-600"> (rentang {fmtNdvi(selectedCells[0].ndvi_min)} s/d {fmtNdvi(selectedCells[0].ndvi_max)})</span>}</div>
                    {ruleOf(selectedCells[0].intensity) && (
                      <div className="text-army-700">Saran: {ruleOf(selectedCells[0].intensity)!.actions.map((a) => `${a.title} (${a.interval_label.toLowerCase()})`).join(", ")}</div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm"><strong>{selectedCells.length}</strong> petak · {fmtHa(selectedCells.reduce((s, c) => s + c.area_ha, 0))} ha</p>
                )}
                {selected.size > 0 && <button className="mt-2 text-sm font-semibold text-army-700 underline" onClick={() => setSelected(new Set())}>Kosongkan pilihan</button>}
                <div className="mt-3 border-t border-army-200 pt-3">
                  <div className="mb-2 text-sm font-medium text-army-800">{selected.size ? `Ekspor ${selected.size} petak` : "Ekspor semua petak"}</div>
                  <ExportBar hrefFor={cellsHref} optionLabel="File terpisah per petak (ZIP)" disabled={!grid} />
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="card p-4" aria-labelledby="draw">
                <h2 id="draw" className="mb-2">Custom petak</h2>
                {pending ? (
                  <form onSubmit={(e) => { e.preventDefault(); savePolygon(); }} className="space-y-3">
                    <p className="text-sm text-army-700">Polygon selesai digambar, ± {fmtHa(draftHa)} ha. Beri nama untuk menyimpan.</p>
                    <div><label className="field-label" htmlFor="pname">Nama polygon</label><input id="pname" className="input" value={polyName} onChange={(e) => setPolyName(e.target.value)} placeholder="Contoh: Target semprot blok A" required maxLength={120} autoFocus /></div>
                    <div className="flex gap-2"><button className="btn-primary flex-1" disabled={!polyName.trim()}>Simpan polygon</button><button type="button" className="btn-ghost" onClick={cancelDraw}>Batal</button></div>
                  </form>
                ) : drawing ? (
                  <p className="text-sm text-army-700">Klik di peta untuk menambah titik sudut. Tekan <strong>Selesai</strong> bila minimal 3 titik sudah ada.</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-army-700">Gambar area target penyemprotan, simpan, lalu ekspor sebagai KML/KMZ.</p>
                    <button className="btn-primary w-full" onClick={() => { setDrawing(true); setSelPoly(null); }}><PencilRuler className="h-4 w-4" aria-hidden /> Gambar polygon baru</button>
                  </>
                )}
              </section>

              <section className="card p-4" aria-labelledby="plist">
                <h2 id="plist" className="mb-2">Polygon tersimpan</h2>
                {polygons.length === 0 ? <p className="text-sm text-army-700">Belum ada polygon.</p> : (
                  <ul className="space-y-2">
                    {polygons.map((p) => (
                      <li key={p.id} className={`rounded border p-3 ${selPoly === p.id ? "border-gold-500 bg-white" : "border-army-200 bg-army-50"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <button className="text-left" onClick={() => { setSelPoly(p.id); setFit((f) => ({ key: f.key + 1, bounds: boundsOf(p.geometry) })); }}>
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-xs text-army-700">{fmtHa(p.area_ha)} ha{p.owner && ` · ${p.owner}`}</div>
                          </button>
                          <button className="rounded p-1.5 text-alert hover:bg-red-50" aria-label={`Hapus ${p.name}`} onClick={() => removePolygon(p)}><Trash2 className="h-4 w-4" /></button>
                        </div>
                        {p.coverage_pct != null && p.coverage_pct < 99.5 && <div className="mt-1 text-xs text-alert">{Math.round(100 - p.coverage_pct)}% area di luar batas lahan.</div>}
                        {selPoly === p.id && (
                          <div className="mt-3">
                            <ExportBar optionLabel="Pecah per petak 1 ha" hrefFor={(fmt, split) => `/api/exports/polygons/${p.id}?format=${fmt}${split ? "&split=true" : ""}`} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
