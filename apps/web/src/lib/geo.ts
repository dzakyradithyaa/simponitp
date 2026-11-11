import type { Bounds, GeoGeometry, Position } from "./types";

/** Approximate polygon area in hectares (equirectangular projection; accurate enough for field-sized shapes). */
export function polygonAreaHa(ring: Position[]): number {
  if (ring.length < 3) return 0;
  const R = 6371008.8;
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const pts = ring.map(([lng, lat]) => [R * Math.cos(lat0) * ((lng * Math.PI) / 180), R * ((lat * Math.PI) / 180)]);
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2 / 10_000;
}

export function boundsOf(geometry: GeoGeometry): Bounds {
  const pts: Position[] = geometry.type === "Polygon" ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
