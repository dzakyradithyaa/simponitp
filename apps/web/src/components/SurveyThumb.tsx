"use client";

import { MapTrifold } from "@phosphor-icons/react";
import { PMTiles } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import type { Bounds } from "@/lib/types";

/*
 * Thumbnail survey: tidak ada endpoint gambar di backend, jadi kita ambil
 * 1-4 tile raster dari arsip PMTiles milik versi itu lalu digambar ke
 * kanvas kecil, dipotong sesuai bounds. Dimuat malas saat kartu terlihat.
 */

const W = 72;
const H = 56;
const SCALE = 2; // kanvas 2x agar tajam di layar retina

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

async function paint(
  canvas: HTMLCanvasElement,
  url: string,
  bounds: Bounds,
  alive: () => boolean
) {
  const pm = new PMTiles(url);
  const header = await pm.getHeader();
  const [w, s, e, n] = bounds;

  // Zoom terbesar yang membuat bounds muat dalam blok <= 2x2 tile.
  let z = header.maxZoom;
  const block = (zz: number) => {
    const x0 = Math.floor(lonToX(w, zz));
    const x1 = Math.floor(lonToX(e, zz));
    const y0 = Math.floor(latToY(n, zz));
    const y1 = Math.floor(latToY(s, zz));
    return { x0, x1, y0, y1, nx: x1 - x0 + 1, ny: y1 - y0 + 1 };
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
  for (let ty = 0; ty < b.ny; ty++) {
    for (let tx = 0; tx < b.nx; tx++) {
      const res = await pm.getZxy(z, b.x0 + tx, b.y0 + ty);
      if (!res) continue;
      const bmp = await createImageBitmap(new Blob([res.data]));
      octx.drawImage(bmp, tx * 256, ty * 256, 256, 256);
      drawn++;
    }
  }
  if (!alive() || drawn === 0) throw new Error("empty");

  // Kotak bounds di dalam blok tile (piksel), lalu "contain" ke kanvas.
  const sx = (lonToX(w, z) - b.x0) * 256;
  const ex = (lonToX(e, z) - b.x0) * 256;
  const sy = (latToY(n, z) - b.y0) * 256;
  const ey = (latToY(s, z) - b.y0) * 256;
  const bw = Math.max(ex - sx, 1);
  const bh = Math.max(ey - sy, 1);

  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#eef0f2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const k = Math.min(canvas.width / bw, canvas.height / bh);
  const dw = bw * k;
  const dh = bh * k;
  ctx.drawImage(
    off,
    sx,
    sy,
    bw,
    bh,
    (canvas.width - dw) / 2,
    (canvas.height - dh) / 2,
    dw,
    dh
  );
}

export function SurveyThumb({
  url,
  bounds,
}: {
  url: string | null;
  bounds: Bounds | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");

  useEffect(() => {
    if (!url || !bounds || !box.current) {
      setState("fail");
      return;
    }
    let alive = true;
    let started = false;

    const run = () => {
      if (started || !canvas.current) return;
      started = true;
      paint(canvas.current, url, bounds, () => alive)
        .then(() => alive && setState("ok"))
        .catch(() => alive && setState("fail"));
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { rootMargin: "80px" }
    );
    io.observe(box.current);

    return () => {
      alive = false;
      io.disconnect();
    };
  }, [url, bounds]);

  return (
    <div
      ref={box}
      className="relative h-14 w-[72px] shrink-0 overflow-hidden rounded border border-[#e2e2e2] bg-[#eef0f2]"
      aria-hidden="true"
    >
      <canvas
        ref={canvas}
        className={`h-full w-full ${state === "ok" ? "" : "invisible"}`}
      />
      {state !== "ok" && (
        <span className="absolute inset-0 grid place-items-center text-[#9a9a9a]">
          <MapTrifold className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}
