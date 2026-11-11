"use client";

import { ArrowRight, Layers, MapPinned, Ruler, Shapes } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, LEVEL_COLOR, LEVEL_LABEL, Notice, Spinner } from "@/components/ui";
import { api, fmtDate, fmtHa, fmtNdvi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DashboardSummary, Intensity } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

function Stat({ icon: Icon, label, value, unit }: { icon: typeof Layers; label: string; value: string; unit?: string }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <Icon className="h-7 w-7 shrink-0 text-gold-600" aria-hidden />
      <div>
        <div className="text-sm text-army-700">{label}</div>
        <div className="font-display text-3xl font-semibold leading-none text-army-900">
          {value}{unit && <span className="ml-1 text-base font-medium text-army-600">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.get<DashboardSummary>("/dashboard/summary").then(setData).catch((e) => setError(e.message)); }, []);

  const f = data?.featured;
  const total = f?.summary.cells ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1">{greeting()}, {user?.full_name.split(" ")[0]}.</h1>
      <p className="mb-6 text-army-700">Ringkasan lahan yang dipantau.</p>

      {error && <Notice kind="error">{error}</Notice>}
      {!data && !error && <Spinner />}

      {data && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={MapPinned} label="Peta" value={String(data.maps)} />
            <Stat icon={Ruler} label="Total luas" value={fmtHa(data.total_area_ha)} unit="ha" />
            <Stat icon={Layers} label="Versi data NDVI" value={String(data.versions)} />
            <Stat icon={Shapes} label="Polygon custom saya" value={String(data.my_polygons)} />
          </div>

          {!f ? (
            <Empty title="Belum ada peta dengan batas lahan">
              {user?.role === "admin" ? <>Mulai dari <Link className="font-semibold underline" href="/upload-peta">Upload Peta</Link> dengan file TIFF.</> : "Hubungi admin untuk menambahkan peta."}
            </Empty>
          ) : (
            <section className="card p-5" aria-labelledby="featured">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="featured">{f.name}</h2>
                  <p className="text-sm text-army-700">
                    {f.version ? <>Data NDVI: {f.version.label} · {fmtDate(f.version.created_at)}</> : "Belum ada data NDVI"}
                  </p>
                </div>
                <Link href={`/peta-saya?map=${f.id}`} className="btn-gold">Buka di Peta Saya <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                <div><div className="font-display text-2xl font-semibold">{f.summary.cells}</div><div className="text-sm text-army-700">petak</div></div>
                <div><div className="font-display text-2xl font-semibold">{fmtHa(f.summary.area_ha)}</div><div className="text-sm text-army-700">hektare</div></div>
                <div><div className="font-display text-2xl font-semibold">{fmtNdvi(f.summary.ndvi_mean)}</div><div className="text-sm text-army-700">NDVI rata-rata</div></div>
              </div>

              {f.summary.by_intensity.none.cells === total ? (
                <Notice>Intensitas muncul setelah TIFF NDVI diunggah admin.</Notice>
              ) : (
                <div>
                  <div className="mb-2 flex h-4 overflow-hidden rounded" role="img"
                       aria-label={(["rendah", "sedang", "tinggi"] as Intensity[]).map((k) => `${LEVEL_LABEL[k]} ${f.summary.by_intensity[k].cells} petak`).join(", ")}>
                    {(["rendah", "sedang", "tinggi"] as Intensity[]).map((k) => (
                      <div key={k} style={{ width: `${(100 * f.summary.by_intensity[k].cells) / total}%`, background: LEVEL_COLOR[k] }} />
                    ))}
                    <div className="bg-army-200" style={{ width: `${(100 * f.summary.by_intensity.none.cells) / total}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {(["rendah", "sedang", "tinggi"] as Intensity[]).map((k) => (
                      <span key={k} className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm" style={{ background: LEVEL_COLOR[k] }} />
                        {LEVEL_LABEL[k]}: <strong>{f.summary.by_intensity[k].cells}</strong> petak ({fmtHa(f.summary.by_intensity[k].area_ha)} ha)
                      </span>
                    ))}
                    {f.summary.by_intensity.none.cells > 0 && <span className="text-army-600">Tanpa data: {f.summary.by_intensity.none.cells}</span>}
                  </div>
                </div>
              )}
            </section>
          )}
          {data.active_users != null && <p className="mt-4 text-sm text-army-600">{data.active_users} akun aktif.</p>}
        </>
      )}
    </div>
  );
}
