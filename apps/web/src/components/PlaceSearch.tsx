"use client";

import {
  CrosshairSimple,
  MagnifyingGlass,
  MapPin,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Bounds } from "@/lib/types";

export interface PinTarget {
  key: number;
  lng: number;
  lat: number;
  kind: "search" | "me";
  bounds?: Bounds | null;
}

interface Hit {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string]; // south, north, west, east
}

/*
 * Pencarian wilayah di navbar. Minimize = hanya ikon; maksimize = panel turun
 * di bawah navbar. Hasil dikirim ke halaman peta lewat event "peta:pin".
 * Data: Nominatim (OpenStreetMap), dikirim saat Enter, bukan tiap ketikan.
 * Lokasi saat ini butuh HTTPS atau localhost.
 */
export const PIN_EVENT = "peta:pin";

export function PlaceSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState<"search" | "me" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const send = (p: PinTarget) => {
    window.dispatchEvent(new CustomEvent<PinTarget>(PIN_EVENT, { detail: p }));
    setOpen(false); // otomatis minimize agar peta langsung terlihat
  };

  async function search() {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setBusy("search");
    setMsg(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=id&accept-language=id&q=${encodeURIComponent(
        text
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Hit[];
      setHits(data);
      if (!data.length) setMsg("Wilayah tidak ditemukan.");
    } catch {
      setHits(null);
      setMsg("Pencarian gagal. Periksa koneksi internet.");
    } finally {
      setBusy(null);
    }
  }

  function pick(h: Hit) {
    const b = h.boundingbox?.map(Number);
    setQ(h.display_name.split(",")[0]);
    setHits(null);
    setMsg(null);
    send({
      key: Date.now(),
      lng: Number(h.lon),
      lat: Number(h.lat),
      kind: "search",
      bounds: b ? ([b[2], b[0], b[3], b[1]] as Bounds) : null,
    });
  }

  function locate() {
    if (busy) return;
    if (!navigator.geolocation) {
      setMsg("Perangkat tidak mendukung lokasi.");
      return;
    }
    setBusy("me");
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(null);
        setHits(null);
        send({
          key: Date.now(),
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
          kind: "me",
        });
      },
      (err) => {
        setBusy(null);
        setMsg(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Aktifkan di pengaturan browser."
            : "Lokasi belum bisa didapat. Pastikan GPS aktif dan situs memakai HTTPS."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div ref={root}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="place-search-panel"
        title={open ? "Minimize pencarian" : "Cari wilayah / lokasi saya"}
        className={`grid h-8 w-8 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920] ${
          open ? "text-[#D71920]" : "text-[#202020] hover:text-[#D71920]"
        }`}
      >
        {open ? (
          <X className="h-[18px] w-[18px]" />
        ) : (
          <MagnifyingGlass className="h-[18px] w-[18px]" />
        )}
        <span className="sr-only">Cari wilayah</span>
      </button>

      <div
        id="place-search-panel"
        aria-hidden={!open}
        className={`fixed right-3 top-[60px] z-50 w-[min(340px,calc(100vw-24px))] transition-[transform,opacity,visibility] duration-[380ms] ease-apple ${
          open
            ? "visible translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-3 opacity-0"
        }`}
      >
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex items-center gap-1 rounded-xl border border-[#e6e6e6] bg-white p-1 shadow-[0_8px_28px_rgba(32,32,32,0.16)]"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Cari desa, kecamatan, atau kota</span>
            <input
              ref={input}
              type="text"
              value={q}
              tabIndex={open ? 0 : -1}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari desa, kecamatan, kota"
              className="h-8 w-full rounded-lg bg-transparent px-2.5 text-xs text-[#202020] placeholder:text-[#9a9a9a] focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            tabIndex={open ? 0 : -1}
            aria-label="Cari"
            title="Cari wilayah"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#202020] transition-colors hover:text-[#D71920] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920]"
          >
            {busy === "search" ? (
              <SpinnerGap className="h-4 w-4 animate-spin" />
            ) : (
              <MagnifyingGlass className="h-4 w-4" />
            )}
          </button>
          <span className="h-5 w-px bg-[#e6e6e6]" aria-hidden="true" />
          <button
            type="button"
            onClick={locate}
            tabIndex={open ? 0 : -1}
            aria-label="Lokasi saya"
            title="Lokasi saya"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#202020] transition-colors hover:text-[#D71920] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920]"
          >
            {busy === "me" ? (
              <SpinnerGap className="h-4 w-4 animate-spin" />
            ) : (
              <CrosshairSimple className="h-4 w-4" />
            )}
          </button>
        </form>

        {(hits !== null || msg !== null) && (
          <div className="mt-1.5 overflow-hidden rounded-xl border border-[#e6e6e6] bg-white shadow-[0_8px_28px_rgba(32,32,32,0.16)]">
            {msg && <p className="px-3 py-2.5 text-xs text-[#6b6b6b]">{msg}</p>}
            {hits && hits.length > 0 && (
              <ul className="max-h-64 divide-y divide-[#f0f0f0] overflow-y-auto">
                {hits.map((h) => {
                  const [name, ...rest] = h.display_name.split(",");
                  return (
                    <li key={h.place_id}>
                      <button
                        type="button"
                        onClick={() => pick(h)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:text-[#D71920] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D71920]"
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            {name}
                          </span>
                          <span className="block truncate text-[11px] text-[#6b6b6b]">
                            {rest.join(",").trim()}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
