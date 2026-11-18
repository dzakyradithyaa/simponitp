/*
 * Konfigurasi peta dasar. Variabel NEXT_PUBLIC_* dibaca saat BUILD,
 * jadi untuk Docker harus tersedia sebagai build arg / env saat `next build`.
 *
 * ESRI_MAXZOOM    Zoom tertinggi yang diminta ke server Esri. Di atasnya peta
 *                 diperbesar dari tile terakhir (agak buram, tapi tidak muncul
 *                 tulisan "Map data not yet available"). Turunkan jika masih muncul.
 * SAT_HD_URL      Opsional: template tile satelit lain yang lebih detail,
 *                 misalnya MapTiler / Mapbox (butuh API key gratis), contoh:
 *                 https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=KUNCI
 */
export type Basemap = "osm" | "satellite" | "hd";

export const ESRI_MAXZOOM = Number(process.env.NEXT_PUBLIC_ESRI_MAXZOOM || 17);
export const SAT_HD_URL = process.env.NEXT_PUBLIC_TILES_SATELLITE_HD || "";
export const SAT_HD_ATTR =
  process.env.NEXT_PUBLIC_TILES_SATELLITE_HD_ATTR || "Satellite imagery";
export const SAT_HD_MAXZOOM = Number(
  process.env.NEXT_PUBLIC_TILES_SATELLITE_HD_MAXZOOM || 20
);
