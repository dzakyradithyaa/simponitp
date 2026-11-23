"use client";

import {
  ArrowSquareOut,
  Check,
  CloudArrowUp,
  FileImage,
  Info,
  MapTrifold,
  PencilSimple,
  Trash,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminOnly } from "@/components/Shell";
import {
  Badge,
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  CARD,
  FOCUS,
  INPUT,
  LABEL,
  Modal,
  Notice,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { api, fmtDate, fmtHa, fmtNdvi } from "@/lib/api";
import type { MapItem, MapVersion } from "@/lib/types";

interface UploadResult {
  created: MapVersion[];
  rejected: { filename: string; error: string }[];
}
const STATUS = {
  processing: { text: "Memproses", tone: "amber" },
  ready: { text: "Siap", tone: "green" },
  failed: { text: "Gagal", tone: "red" },
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
  const [uploaded, setUploaded] = useState<{
    ids: number[];
    rejected: UploadResult["rejected"];
  }>({ ids: [], rejected: [] });
  const [sel, setSel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState<{
    kind: "map" | "version";
    id: number;
    mapId?: number;
    value: string;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const list = await api.get<MapItem[]>("/maps");
    setMaps(list);
    setSel((cur) =>
      cur && list.some((m) => m.id === cur) ? cur : list[0]?.id ?? null
    );
    return list;
  }, []);
  useEffect(() => {
    load()
      .then((l) => setTarget(l[0]?.id ?? "new"))
      .catch((e) => setError(e.message));
  }, [load]);

  // refresh while a TIFF is still being turned into tiles
  const processing = !!maps?.some((m) =>
    m.versions.some((v) => v.status === "processing")
  );
  useEffect(() => {
    if (!processing) return;
    const t = window.setInterval(() => load().catch(() => {}), 2500);
    return () => window.clearInterval(t);
  }, [processing, load]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list))
      if (!next.some((x) => x.name === f.name && x.size === f.size))
        next.push(f);
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length || (target === "new" && name.trim().length < 2)) return;
    setError(null);
    setOk(null);
    setProgress(0);
    setUploaded({ ids: [], rejected: [] });
    try {
      let mapId = target;
      if (mapId === "new") {
        const m = await api.post<MapItem>("/maps", {
          name: name.trim(),
          description: desc.trim() || null,
        });
        mapId = m.id;
        setSel(m.id);
      }
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      if (label.trim()) form.append("label", label.trim());
      const res = await api.upload<UploadResult>(
        `/maps/${mapId}/versions`,
        form,
        setProgress
      );
      setUploaded({
        ids: res.created.map((v) => v.id),
        rejected: res.rejected,
      });
      setFiles([]);
      setLabel("");
      setName("");
      setDesc("");
      if (input.current) input.current.value = "";
      const list = await load();
      setTarget(mapId);
      setSel(mapId);
      if (!list.some((m) => m.id === mapId)) setTarget("new");
    } catch (err) {
      setError((err as Error).message);
      await load().catch(() => {});
    }
    setProgress(null);
  }

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      await fn();
      await load();
      if (success) setOk(success);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  const map = maps?.find((m) => m.id === sel) ?? null;
  const removeMap = (m: MapItem) =>
    confirm(
      `Hapus peta "${m.name}" beserta semua versi dan polygon-nya? Tindakan ini tidak bisa dibatalkan.`
    ) && run(() => api.del(`/maps/${m.id}`), "Peta dihapus.");
  const removeVersion = (v: MapVersion) =>
    confirm(`Hapus versi v${v.version} (${v.label})?`) &&
    run(() => api.del(`/maps/${v.map_id}/versions/${v.id}`), "Versi dihapus.");
  const activate = (v: MapVersion) =>
    run(
      () =>
        api.patch(`/maps/${v.map_id}/versions/${v.id}`, { is_active: true }),
      `v${v.version} sekarang aktif.`
    );
  const submitRename = () => {
    if (!rename) return;
    const r = rename;
    setRename(null);
    run(
      () =>
        r.kind === "map"
          ? api.patch(`/maps/${r.id}`, { name: r.value.trim() })
          : api.patch(`/maps/${r.mapId}/versions/${r.id}`, {
              label: r.value.trim(),
            }),
      "Nama diperbarui."
    );
  };

  if (!maps) return error ? <Notice kind="error">{error}</Notice> : <Spinner />;
  const busyUpload = progress !== null;
  const justUploaded = maps
    .flatMap((m) => m.versions)
    .filter((v) => uploaded.ids.includes(v.id));
  const canSend =
    !busyUpload &&
    files.length > 0 &&
    !(target === "new" && name.trim().length < 2);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Upload peta"
        desc="Unggah GeoTIFF NDVI. File diubah menjadi tile untuk Peta Saya lalu dibagi menjadi petak 1 hektare. Area peta diambil dari TIFF pertama."
      />
      <div className="mb-4 space-y-2 empty:hidden">
        {error && <Notice kind="error">{error}</Notice>}
        {ok && <Notice kind="success">{ok}</Notice>}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* ---- Form unggah ---- */}
        <form
          onSubmit={submit}
          className={`${CARD} space-y-4 p-4 lg:sticky lg:top-20`}
          aria-labelledby="up"
        >
          <h2 id="up">Unggah TIFF</h2>

          <div>
            <label className={LABEL} htmlFor="target">
              Peta tujuan
            </label>
            <select
              id="target"
              className={INPUT}
              value={target}
              onChange={(e) =>
                setTarget(
                  e.target.value === "new" ? "new" : Number(e.target.value)
                )
              }
            >
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="new">+ Peta baru</option>
            </select>
          </div>

          {target === "new" ? (
            <>
              <div>
                <label className={LABEL} htmlFor="name">
                  Nama peta baru
                </label>
                <input
                  id="name"
                  className={INPUT}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Contoh: Kayangan Blok A"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="desc">
                  Deskripsi (opsional)
                </label>
                <input
                  id="desc"
                  className={INPUT}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  maxLength={500}
                />
              </div>
            </>
          ) : (
            <div>
              <label className={LABEL} htmlFor="label">
                Label versi (opsional)
              </label>
              <input
                id="label"
                className={INPUT}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={120}
                placeholder="Contoh: Survei November"
              />
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-300 ${
              over
                ? "border-[#D71920] bg-[#FDECEC]"
                : "border-[#d9d9d9] bg-[#fafafa]"
            }`}
          >
            <CloudArrowUp
              className={`mx-auto mb-2 h-8 w-8 transition ${
                over ? "text-[#D71920]" : "text-[#6b6b6b]"
              }`}
              aria-hidden="true"
            />
            <p className="text-sm font-semibold">Tarik file TIFF ke sini</p>
            <p className="mb-3 mt-0.5 text-xs text-[#6b6b6b]">
              Boleh lebih dari satu. Setiap file menjadi satu versi.
            </p>
            <input
              ref={input}
              id="files"
              type="file"
              accept=".tif,.tiff"
              multiple
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
            <label htmlFor="files" className={`${BTN_GHOST} cursor-pointer`}>
              Pilih file
            </label>
          </div>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((f) => (
                <li
                  key={f.name + f.size}
                  className="flex items-center gap-2 rounded-lg bg-[#f6f6f6] px-2.5 py-1.5 text-xs"
                >
                  <FileImage
                    className="h-4 w-4 shrink-0 text-[#6b6b6b]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 tabular-nums text-[#6b6b6b]">
                    {(f.size / 1048576).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((x) => x !== f))}
                    aria-label={`Hapus ${f.name}`}
                    className={`rounded p-0.5 text-[#6b6b6b] hover:text-[#D71920] ${FOCUS}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {busyUpload && (
            <div aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#eee]">
                <div
                  className="h-full rounded-full bg-[#D71920] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[#6b6b6b]">
                {progress === 100 ? "Menyimpan..." : `Mengunggah ${progress}%`}
              </p>
            </div>
          )}

          <button className={`${BTN_PRIMARY} w-full`} disabled={!canSend}>
            {busyUpload ? "Mengunggah..." : "Unggah dan proses"}
          </button>

          {(justUploaded.length > 0 || uploaded.rejected.length > 0) && (
            <ul className="space-y-2" aria-label="Hasil unggahan">
              {justUploaded.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-[#e6e6e6] p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      v{v.version} · {v.label}
                    </span>
                    <Badge tone={STATUS[v.status].tone}>
                      {STATUS[v.status].text}
                    </Badge>
                  </div>
                  {v.status === "ready" && v.stats && (
                    <p className="mt-1 text-[#6b6b6b]">
                      NDVI rata-rata {fmtNdvi(v.stats.mean)} (
                      {fmtNdvi(v.stats.min)} s/d {fmtNdvi(v.stats.max)}) ·{" "}
                      <Link
                        className="inline-flex items-center gap-0.5 font-semibold text-[#D71920] hover:underline"
                        href={`/peta-saya?map=${v.map_id}`}
                      >
                        Lihat di Peta Saya
                        <ArrowSquareOut className="h-3 w-3" />
                      </Link>
                    </p>
                  )}
                  {v.status === "failed" && (
                    <p className="mt-1 text-[#D71920]">{v.error}</p>
                  )}
                </li>
              ))}
              {uploaded.rejected.map((r) => (
                <li
                  key={r.filename}
                  className="rounded-lg border border-[#f0c4c6] bg-[#FDECEC] p-2.5 text-xs"
                >
                  <strong>{r.filename}</strong>: {r.error}
                </li>
              ))}
            </ul>
          )}
        </form>

        {/* ---- Kelola peta ---- */}
        <div className="min-w-0 space-y-3">
          {maps.length === 0 ? (
            <section className={`${CARD} px-4 py-8 text-center sm:px-6 sm:py-10`} aria-labelledby="no-maps">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[#FDECEC] text-[#D71920]">
                <MapTrifold className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <h2 id="no-maps">Belum ada peta</h2>
                <div className="group relative">
                  <button
                    type="button"
                    aria-label="Info unggah peta"
                    aria-describedby="no-maps-help"
                    className={`grid h-7 w-7 place-items-center rounded-md text-[#6b6b6b] hover:bg-[#f1f1f1] ${FOCUS}`}
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div
                    id="no-maps-help"
                    role="tooltip"
                    className="invisible absolute right-0 top-full z-10 w-44 pt-1 opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  >
                    <p className="rounded-lg bg-[#202020] px-3 py-2 text-left text-xs leading-relaxed text-white shadow-md">
                      Unggah GeoTIFF NDVI pertama untuk mulai membuat peta.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`${BTN_GHOST} mt-4`}
                disabled={busyUpload}
                onClick={() => input.current?.click()}
              >
                <FileImage className="h-4 w-4" aria-hidden="true" />
                Pilih file GeoTIFF
              </button>
              <ol className="mx-auto mt-6 grid max-w-[480px] gap-3 border-t border-[#e6e6e6] pt-5 text-xs text-[#4a4a4a] sm:grid-cols-3">
                {["Beri nama peta", "Unggah GeoTIFF", "Kelola versi peta"].map((step, index) => (
                  <li key={step} className="flex items-center gap-2 text-left sm:justify-center">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f1f1f1] font-semibold">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <>
              <ul
                className="flex gap-2 overflow-x-auto pb-1"
                aria-label="Daftar peta"
              >
                {maps.map((m) => (
                  <li key={m.id} className="shrink-0">
                    <button
                      onClick={() => setSel(m.id)}
                      aria-pressed={sel === m.id}
                      className={`w-44 rounded-xl border p-2.5 text-left transition ${FOCUS} ${
                        sel === m.id
                          ? "border-[#D71920] bg-[#FDECEC]"
                          : "border-[#e6e6e6] bg-white hover:border-[#202020]"
                      }`}
                    >
                      <span className="block truncate text-sm font-semibold">
                        {m.name}
                      </span>
                      <span className="block truncate text-xs text-[#6b6b6b]">
                        {m.has_boundary
                          ? `${fmtHa(m.area_ha ?? 0)} ha`
                          : "Belum ada TIFF"}{" "}
                        · {m.versions.length} versi
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {map && (
                <section
                  className={`${CARD} p-4`}
                  aria-label={`Kelola ${map.name}`}
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate">{map.name}</h2>
                      {map.description && (
                        <p className="mt-0.5 text-xs text-[#6b6b6b]">
                          {map.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        className={BTN_GHOST}
                        onClick={() =>
                          setRename({
                            kind: "map",
                            id: map.id,
                            value: map.name,
                          })
                        }
                      >
                        <PencilSimple className="h-4 w-4" aria-hidden="true" />{" "}
                        Ubah nama
                      </button>
                      <button
                        className={BTN_DANGER}
                        aria-label="Hapus peta"
                        onClick={() => removeMap(map)}
                      >
                        <Trash className="h-4 w-4" aria-hidden="true" /> Hapus
                      </button>
                    </div>
                  </div>

                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]">
                    Versi peta
                  </h3>
                  {map.versions.length === 0 ? (
                    <p className="text-sm text-[#6b6b6b]">
                      Belum ada versi. Unggah TIFF di samping.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {[...map.versions].reverse().map((v) => {
                        const label = v.label.trim();
                        const fileStem = v.original_filename.replace(/\.tiff?$/i, "");
                        const showLabel = label && ![fileStem, v.original_filename].some(
                          (name) => name.toLowerCase() === label.toLowerCase()
                        );

                        return (
                          <li
                            key={v.id}
                            className={`rounded-lg border p-4 ${v.is_active ? "border-[#D71920]/40 bg-[#FDECEC]/40" : "border-[#e6e6e6]"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="break-words text-sm font-semibold">
                                  Versi {v.version}{showLabel ? ` · ${label}` : ""}
                                </h4>
                                {v.is_active && (
                                  <Link href={`/peta-saya?map=${v.map_id}`} className={`${BTN_GHOST} mt-2`}>
                                    <ArrowSquareOut className="h-4 w-4" aria-hidden="true" />
                                    Tampil di Peta Saya
                                  </Link>
                                )}
                              </div>
                              <details className="relative shrink-0">
                                <summary
                                  aria-label={`Aksi versi ${v.version}`}
                                  className={`${BTN_GHOST} w-9 cursor-pointer list-none px-0 [&::-webkit-details-marker]:hidden`}
                                >
                                  <span aria-hidden="true">⋯</span>
                                </summary>
                                <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-[#e6e6e6] bg-white p-1 shadow-md">
                                  <button
                                    type="button"
                                    className={`w-full rounded px-2 py-2 text-left text-xs hover:bg-[#f6f6f6] ${FOCUS}`}
                                    onClick={(e) => {
                                      e.currentTarget.closest("details")?.removeAttribute("open");
                                      setRename({ kind: "version", id: v.id, mapId: map.id, value: v.label });
                                    }}
                                  >
                                    Ubah label
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className={`w-full rounded px-2 py-2 text-left text-xs text-[#D71920] hover:bg-[#FDECEC] disabled:opacity-50 ${FOCUS}`}
                                    onClick={(e) => {
                                      e.currentTarget.closest("details")?.removeAttribute("open");
                                      removeVersion(v);
                                    }}
                                  >
                                    Hapus versi
                                  </button>
                                </div>
                              </details>
                            </div>
                            <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                              <div>
                                <dt className="mb-1 text-[#6b6b6b]">Status file</dt>
                                <dd><Badge tone={STATUS[v.status].tone}>{STATUS[v.status].text}</Badge></dd>
                              </div>
                              <div>
                                <dt className="mb-1 text-[#6b6b6b]">Diunggah</dt>
                                <dd>{fmtDate(v.created_at)}</dd>
                              </div>
                              <div className="min-w-0">
                                <dt className="mb-1 text-[#6b6b6b]">File sumber</dt>
                                <dd className="break-words">{v.original_filename}</dd>
                              </div>
                              {v.stats && (
                                <div>
                                  <dt className="mb-1 text-[#6b6b6b]">NDVI rata-rata</dt>
                                  <dd>{fmtNdvi(v.stats.mean)}</dd>
                                </div>
                              )}
                              {v.error && (
                                <div className="break-words text-[#A3121A] sm:col-span-2">
                                  <dt className="mb-1 font-semibold">Kendala</dt>
                                  <dd>{v.error}</dd>
                                </div>
                              )}
                            </dl>
                            {!v.is_active && v.status === "ready" && (
                              <button type="button" className={`${BTN_GHOST} mt-3`} disabled={busy} onClick={() => activate(v)}>
                                <Check className="h-4 w-4" aria-hidden="true" />
                                Jadikan versi aktif
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {rename && (
        <Modal
          title={rename.kind === "map" ? "Ubah nama peta" : "Ubah label versi"}
          onClose={() => setRename(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
          >
            <input
              className={`${INPUT} mb-4`}
              value={rename.value}
              onChange={(e) => setRename({ ...rename, value: e.target.value })}
              autoFocus
              required
              maxLength={120}
              aria-label="Nama baru"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={`${BTN_GHOST} flex-1`}
                onClick={() => setRename(null)}
              >
                Batal
              </button>
              <button
                className={`${BTN_PRIMARY} flex-1`}
                disabled={!rename.value.trim()}
              >
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function UploadPetaPage() {
  return (
    <AdminOnly>
      <Content />
    </AdminOnly>
  );
}
