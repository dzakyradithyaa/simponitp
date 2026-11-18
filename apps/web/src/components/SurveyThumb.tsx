"use client";

import { MapTrifold } from "@phosphor-icons/react";
import { PMTiles } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import type { Bounds } from "@/lib/types";

/*
 * Thumbnail peta NDVI asli. Tidak ada endpoint gambar di backend, jadi 1-4 tile
 * raster diambil dari arsip PMTiles lalu digambar ke kanvas kecil dan disimpan
 * sebagai gambar WebP mungil.
 *
 * Hemat performa:
 * - dibuat hanya saat kartu terlihat di layar (IntersectionObserver)
 * - maksimal 2 thumbnail diproses bersamaan (antrean)
 * - hasil di-cache di memori, jadi membuka ulang panel tidak mengunduh lagi
 * - satu objek PMTiles dipakai ulang per arsip (header tidak diunduh ulang)
 */

const SCALE = 2; // kanvas 2x agar tajam di layar retina
const MAX_PARALLEL = 2;

const cache = new Map<string, string | null>(); // kunci -> data URL, null = gagal
const pending = new Map<string, Promise<string | null>>();
const archives = new Map<string, PMTiles>();

let running = 0;
const queue: Array<() => void> = [];
function limited<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      running++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < MAX_PARALLEL) run();
    else queue.push(run);
  });
}

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

async function render(
  url: string,
  bounds: Bounds,
  w: number,
  h: number
): Promise<string> {
  let pm = archives.get(url);
  if (!pm) {
    pm = new PMTiles(url);
    archives.set(url, pm);
  }
  const header = await pm.getHeader();
  const [bw0, bs, be, bn] = bounds;

  // Zoom terbesar yang membuat bounds muat dalam blok <= 2x2 tile.
  let z = header.maxZoom;
  const block = (zz: number) => {
    const x0 = Math.floor(lonToX(bw0, zz));
    const x1 = Math.floor(lonToX(be, zz));
    const y0 = Math.floor(latToY(bn, zz));
    const y1 = Math.floor(latToY(bs, zz));
    return { x0, y0, nx: x1 - x0 + 1, ny: y1 - y0 + 1 };
  };
  while (z > header.minZoom) {
    const b = block(z);
    if (b.nx <= 2 && b.ny <= 2) break;
    z--;
  }
  const b = block(z);

  const off = document.createElement("canvas");
  off.width = b.nx * 256;
  off.height = b.ny * 256;
  const octx = off.getContext("2d");
  if (!octx) throw new Error("no canvas");

  let drawn = 0;
  for (let ty = 0; ty < b.ny; ty++)
    for (let tx = 0; tx < b.nx; tx++) {
      const res = await pm.getZxy(z, b.x0 + tx, b.y0 + ty);
      if (!res) continue;
      const bmp = await createImageBitmap(new Blob([res.data]));
      octx.drawImage(bmp, tx * 256, ty * 256, 256, 256);
      bmp.close();
      drawn++;
    }
  if (!drawn) throw new Error("empty");

  // Kotak bounds di dalam blok tile (piksel), lalu dipotong dan diisi penuh ("cover").
  const sx = (lonToX(bw0, z) - b.x0) * 256;
  const ex = (lonToX(be, z) - b.x0) * 256;
  const sy = (latToY(bn, z) - b.y0) * 256;
  const ey = (latToY(bs, z) - b.y0) * 256;
  const sw = Math.max(ex - sx, 1);
  const sh = Math.max(ey - sy, 1);

  const out = document.createElement("canvas");
  out.width = w * SCALE;
  out.height = h * SCALE;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#eef0f2";
  ctx.fillRect(0, 0, out.width, out.height);

  const k = Math.min(out.width / sw, out.height / sh); // "contain": seluruh lahan terlihat
  const dw = sw * k;
  const dh = sh * k;
  ctx.drawImage(
    off,
    sx,
    sy,
    sw,
    sh,
    (out.width - dw) / 2,
    (out.height - dh) / 2,
    dw,
    dh
  );
  return out.toDataURL("image/webp", 0.82);
}

function load(
  url: string,
  bounds: Bounds,
  w: number,
  h: number
): Promise<string | null> {
  const key = `${url}|${w}x${h}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  let p = pending.get(key);
  if (!p) {
    p = limited(() => render(url, bounds, w, h))
      .catch(() => null)
      .then((src) => {
        cache.set(key, src);
        pending.delete(key);
        return src;
      });
    pending.set(key, p);
  }
  return p;
}

export function SurveyThumb({
  url,
  bounds,
  w = 72,
  h = 56,
}: {
  url: string | null;
  bounds: Bounds | null;
  w?: number;
  h?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const key = url ? `${url}|${w}x${h}` : "";
  const [src, setSrc] = useState<string | null | undefined>(() =>
    key && cache.has(key) ? cache.get(key) ?? null : undefined
  );

  useEffect(() => {
    if (!url || !bounds) {
      setSrc(null);
      return;
    }
    if (cache.has(key)) {
      setSrc(cache.get(key) ?? null);
      return;
    }
    const el = box.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((x) => x.isIntersecting)) return;
        io.disconnect();
        load(url, bounds, w, h).then((s) => alive && setSrc(s));
      },
      { rootMargin: "60px" }
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [url, bounds, key, w, h]);

  return (
    <div
      ref={box}
      style={{ width: w, height: h }}
      className="relative shrink-0 overflow-hidden rounded border border-[#e2e2e2] bg-[#eef0f2]"
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={w}
          height={h}
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className={`absolute inset-0 grid place-items-center text-[#9a9a9a] ${
            src === undefined ? "animate-pulse" : ""
          }`}
        >
          <MapTrifold className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
