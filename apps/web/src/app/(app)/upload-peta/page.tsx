"use client";

import { Check, CloudUpload, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminOnly } from "@/components/Shell";
import { Modal, Notice, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate, fmtHa, fmtNdvi } from "@/lib/api";
import type { MapItem, MapVersion } from "@/lib/types";

interface UploadResult { created: MapVersion[]; rejected: { filename: string; error: string }[] }
const STATUS = {
  processing: { text: "Memproses...", cls: "bg-gold-300/50 text-army-900" },
  ready: { text: "Siap", cls: "bg-army-200 text-army-900" },
  failed: { text: "Gagal", cls: "bg-red-100 text-alert" },
} as const;

function Content() {
  const [maps, setMaps] = useState<MapItem[] | null>(null);
  const [target, setTarget] = useState<number | "new">("new");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [label, setLabel] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState<{ ids: number[]; rejected: UploadResult["rejected"] }>({ ids: [], rejected: [] });
  const [sel, setSel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState<{ kind: "map" | "version"; id: number; mapId?: number; value: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const list = await api.get<MapItem[]>("/maps");
    setMaps(list);
    setSel((cur) => (cur && list.some((m) => m.id === cur) ? cur : list[0]?.id ?? null));
    return list;
  }, []);
  useEffect(() => {
    load().then((l) => setTarget(l[0]?.id ?? "new")).catch((e) => setError(e.message));
  }, [load]);

  // keep refreshing while any TIFF is still being turned into tiles
  const processing = !!maps?.some((m) => m.versions.some((v) => v.status === "processing"));
  useEffect(() => {
    if (!processing) return;
    const t = window.setInterval(() => load().catch(() => {}), 2500);
    return () => window.clearInterval(t);
  }, [processing, load]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length || (target === "new" && name.trim().length < 2)) return;
    setError(null); setOk(null); setProgress(0); setUploaded({ ids: [], rejected: [] });
    try {
      let mapId = target;
      if (mapId === "new") {
        const m = await api.post<MapItem>("/maps", { name: name.trim(), description: desc.trim() || null });
        mapId = m.id;
        setSel(m.id);
      }
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      if (label.trim()) form.append("label", label.trim());
      const res = await api.upload<UploadResult>(`/maps/${mapId}/versions`, form, setProgress);
      setUploaded({ ids: res.created.map((v) => v.id), rejected: res.rejected });
      setFiles([]); setLabel(""); setName(""); setDesc("");
      if (input.current) input.current.value = "";
      const list = await load();
      setTarget(mapId); setSel(mapId);
      if (!list.some((m) => m.id === mapId)) setTarget("new");
    } catch (err) { setError((err as Error).message); await load().catch(() => {}); }
    setProgress(null);
  }

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setError(null); setOk(null); setBusy(true);
    try { await fn(); await load(); if (success) setOk(success); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  const map = maps?.find((m) => m.id === sel) ?? null;
  const removeMap = (m: MapItem) => confirm(`Hapus peta "${m.name}" beserta semua versi dan polygon-nya? Tindakan ini tidak bisa dibatalkan.`) && run(() => api.del(`/maps/${m.id}`), "Peta dihapus.");
  const removeVersion = (v: MapVersion) => confirm(`Hapus versi v${v.version} (${v.label})?`) && run(() => api.del(`/maps/${v.map_id}/versions/${v.id}`), "Versi dihapus.");
  const activate = (v: MapVersion) => run(() => api.patch(`/maps/${v.map_id}/versions/${v.id}`, { is_active: true }), `v${v.version} sekarang aktif.`);
  const submitRename = () => {
    if (!rename) return;
    const r = rename;
    setRename(null);
    run(() => (r.kind === "map" ? api.patch(`/maps/${r.id}`, { name: r.value.trim() }) : api.patch(`/maps/${r.mapId}/versions/${r.id}`, { label: r.value.trim() })), "Nama diperbarui.");
  };

  if (!maps) return error ? <Notice kind="error">{error}</Notice> : <Spinner />;
  const busyUpload = progress !== null;
  const justUploaded = maps.flatMap((m) => m.versions).filter((v) => uploaded.ids.includes(v.id));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Upload peta" />
      <p className="mb-5 max-w-prose text-army-700">Unggah peta dalam format TIFF (GeoTIFF NDVI). File diubah menjadi tile untuk ditampilkan di Peta Saya, lalu dibagi menjadi petak 1 hektare. Area peta diambil dari TIFF pertama.</p>
      <div className="mb-4 space-y-2">{error && <Notice kind="error">{error}</Notice>}{ok && <Notice kind="success">{ok}</Notice>}</div>

      <form onSubmit={submit} className="card mb-6 space-y-4 p-5" aria-labelledby="up">
        <h2 id="up">Upload TIFF</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="target">Peta tujuan</label>
            <select id="target" className="input" value={target} onChange={(e) => setTarget(e.target.value === "new" ? "new" : Number(e.target.value))}>
              {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value="new">+ Peta baru</option>
            </select>
          </div>
          {target === "new" ? (
            <div><label className="field-label" htmlFor="name">Nama peta baru</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Contoh: Kayangan Blok A" /></div>
          ) : (
            <div><label className="field-label" htmlFor="label">Label versi (opsional)</label><input id="label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Contoh: Survei November" /></div>
          )}
        </div>
        {target === "new" && <div><label className="field-label" htmlFor="desc">Deskripsi (opsional)</label><input id="desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} /></div>}

        <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
             className={`rounded-md border-2 border-dashed px-4 py-8 text-center ${over ? "border-gold-500 bg-gold-300/20" : "border-army-300 bg-white"}`}>
          <CloudUpload className="mx-auto mb-2 h-8 w-8 text-army-600" aria-hidden />
          <p className="font-medium text-army-900">Tarik file TIFF ke sini</p>
          <p className="mb-3 text-sm text-army-600">Boleh lebih dari satu file. Setiap file menjadi satu versi peta.</p>
          <input ref={input} id="files" type="file" accept=".tif,.tiff" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
          <label htmlFor="files" className="btn-ghost cursor-pointer">Pilih file TIFF</label>
        </div>

        {files.length > 0 && (
          <ul className="divide-y divide-army-200 rounded border border-army-200 bg-white text-sm">
            {files.map((f) => (
              <li key={f.name + f.size} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate">{f.name} <span className="text-army-600">({(f.size / 1048576).toFixed(1)} MB)</span></span>
                <button type="button" onClick={() => setFiles(files.filter((x) => x !== f))} aria-label={`Hapus ${f.name}`} className="rounded p-1 text-army-600 hover:bg-army-100"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}

        {busyUpload && (
          <div aria-live="polite">
            <div className="h-2 overflow-hidden rounded bg-army-200"><div className="h-full bg-gold-500 transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-1 text-sm text-army-700">{progress === 100 ? "Menyimpan..." : `Mengunggah ${progress}%`}</p>
          </div>
        )}
        <button className="btn-primary" disabled={busyUpload || !files.length || (target === "new" && name.trim().length < 2)}>{busyUpload ? "Mengunggah..." : "Unggah dan proses"}</button>

        {(justUploaded.length > 0 || uploaded.rejected.length > 0) && (
          <ul className="space-y-2" aria-label="Hasil unggahan">
            {justUploaded.map((v) => (
              <li key={v.id} className="rounded border border-army-200 bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-medium">v{v.version} · {v.label}</span><span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS[v.status].cls}`}>{STATUS[v.status].text}</span></div>
                {v.status === "ready" && v.stats && <p className="mt-1 text-army-700">NDVI rata-rata {fmtNdvi(v.stats.mean)} (rentang {fmtNdvi(v.stats.min)} s/d {fmtNdvi(v.stats.max)}) · <Link className="font-semibold underline" href={`/peta-saya?map=${v.map_id}`}>Lihat di Peta Saya</Link></p>}
                {v.status === "failed" && <p className="mt-1 text-alert">{v.error}</p>}
              </li>
            ))}
            {uploaded.rejected.map((r) => <li key={r.filename} className="rounded border border-alert/30 bg-red-50 px-3 py-2 text-sm"><strong>{r.filename}</strong>: {r.error}</li>)}
          </ul>
        )}
      </form>

      {maps.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="space-y-2" aria-label="Daftar peta">
            {maps.map((m) => (
              <li key={m.id}>
                <button onClick={() => setSel(m.id)} aria-pressed={sel === m.id} className={`w-full rounded-md border p-3 text-left ${sel === m.id ? "border-gold-500 bg-white" : "border-army-200 bg-[#f7f8f2] hover:bg-white"}`}>
                  <div className="font-display text-lg font-semibold text-army-900">{m.name}</div>
                  <div className="text-sm text-army-700">{m.has_boundary ? `${fmtHa(m.area_ha)} ha` : "Belum ada TIFF"} · {m.versions.length} versi</div>
                </button>
              </li>
            ))}
          </ul>

          {map && (
            <section className="card p-5" aria-label={`Kelola ${map.name}`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div><h2>{map.name}</h2>{map.description && <p className="text-sm text-army-700">{map.description}</p>}</div>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => setRename({ kind: "map", id: map.id, value: map.name })}><Pencil className="h-4 w-4" aria-hidden /> Ubah nama</button>
                  <button className="btn-danger" onClick={() => removeMap(map)}><Trash2 className="h-4 w-4" aria-hidden /> Hapus</button>
                </div>
              </div>
              <h3 className="mb-2 text-lg">Versi peta</h3>
              {map.versions.length === 0 ? <p className="text-sm text-army-700">Belum ada versi. Unggah TIFF di atas.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-army-200"><tr><th className="th">Versi</th><th className="th">NDVI</th><th className="th">Status</th><th className="th"><span className="sr-only">Aksi</span></th></tr></thead>
                    <tbody className="divide-y divide-army-100">
                      {[...map.versions].reverse().map((v) => (
                        <tr key={v.id}>
                          <td className="td"><div className="font-medium">v{v.version} · {v.label}{v.is_active && <span className="ml-2 rounded bg-gold-300/60 px-1.5 py-0.5 text-xs font-semibold">Aktif</span>}</div><div className="text-xs text-army-600">{v.original_filename} · {fmtDate(v.created_at)}</div></td>
                          <td className="td">{v.stats ? fmtNdvi(v.stats.mean) : "-"}</td>
                          <td className="td"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS[v.status].cls}`}>{STATUS[v.status].text}</span>{v.error && <div className="mt-1 max-w-[16rem] text-xs text-alert">{v.error}</div>}</td>
                          <td className="td">
                            <div className="flex justify-end gap-1">
                              <button className="btn-ghost px-2 py-1" disabled={busy || v.is_active || v.status !== "ready"} onClick={() => activate(v)}><Check className="h-4 w-4" aria-hidden /> Aktifkan</button>
                              <button className="btn-ghost px-2 py-1" aria-label={`Ubah label v${v.version}`} onClick={() => setRename({ kind: "version", id: v.id, mapId: map.id, value: v.label })}><Pencil className="h-4 w-4" /></button>
                              <button className="btn-danger px-2 py-1" aria-label={`Hapus v${v.version}`} disabled={busy} onClick={() => removeVersion(v)}><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {rename && (
        <Modal title={rename.kind === "map" ? "Ubah nama peta" : "Ubah label versi"} onClose={() => setRename(null)}>
          <form onSubmit={(e) => { e.preventDefault(); submitRename(); }}>
            <input className="input mb-4" value={rename.value} onChange={(e) => setRename({ ...rename, value: e.target.value })} autoFocus required maxLength={120} aria-label="Nama baru" />
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setRename(null)}>Batal</button><button className="btn-primary" disabled={!rename.value.trim()}>Simpan</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function UploadPetaPage() { return <AdminOnly><Content /></AdminOnly>; }
