import type {
  CellFeature,
  CellProps,
  GeoGeometry,
  Intensity,
  PolygonItem,
  Position,
  Rule,
} from "@/lib/types";

import polygonClipping from "polygon-clipping";

/*
 * Analisis polygon custom di sisi browser, dengan MASKING:
 * polygon dipotong (irisan geometri) terhadap tiap petak 1 ha yang
 * disentuhnya. Gabungan potongan itu menjadi bentuk "masking": tidak ada
 * bagian polygon yang keluar dari petak NDVI. Luas tiap potongan dihitung
 * dari geometri, bukan dari pencuplikan.
 */

type Ring = Position[];
const toMP = (g: GeoGeometry): Position[][][] =>
  g.type === "Polygon" ? [g.coordinates] : g.coordinates;

function bboxOf(g: GeoGeometry): [number, number, number, number] {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const rings of toMP(g))
    for (const [x, y] of rings[0]) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
  return [w, s, e, n];
}

// Luas bidang datar (m2) dengan proyeksi equirectangular lokal.
function ringArea(r: Ring, lat0: number) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    a += r[j][0] * kx * (r[i][1] * ky) - r[i][0] * kx * (r[j][1] * ky);
  return Math.abs(a / 2);
}
function mpArea(mp: Position[][][]) {
  if (!mp.length || !mp[0].length) return 0;
  const lat0 = mp[0][0][0][1];
  let t = 0;
  for (const rings of mp)
    rings.forEach((r, i) => {
      const a = ringArea(r, lat0);
      t += i === 0 ? a : -a;
    });
  return t;
}

const asGeometry = (mp: Position[][][]): GeoGeometry | null =>
  mp.length === 0
    ? null
    : mp.length === 1
    ? { type: "Polygon", coordinates: mp[0] }
    : { type: "MultiPolygon", coordinates: mp };

const clip = (
  op: "intersection" | "union",
  a: Position[][][],
  ...r: Position[][][][]
) =>
  (polygonClipping[op] as unknown as (...x: never[]) => Position[][][])(
    a as never,
    ...(r as never[])
  );

export type LevelKey = Intensity | "none";
export const LEVELS3: Intensity[] = ["rendah", "sedang", "tinggi"];

export interface CellHit {
  props: CellProps;
  geometry: GeoGeometry;
  frac: number;
  ha: number;
}

export interface Summary {
  cells: number;
  area_ha: number;
  ndvi_mean: number | null;
  by: Record<LevelKey, { cells: number; ha: number }>;
  dominant: Intensity | null;
}

const emptyBy = (): Summary["by"] => ({
  rendah: { cells: 0, ha: 0 },
  sedang: { cells: 0, ha: 0 },
  tinggi: { cells: 0, ha: 0 },
  none: { cells: 0, ha: 0 },
});

export function summarize(
  items: { intensity: Intensity | null; ndvi: number | null; ha: number }[]
): Summary {
  const by = emptyBy();
  let area = 0;
  let nSum = 0;
  let nW = 0;
  for (const it of items) {
    const k: LevelKey = it.intensity ?? "none";
    by[k].cells += 1;
    by[k].ha += it.ha;
    area += it.ha;
    if (it.ndvi != null) {
      nSum += it.ndvi * it.ha;
      nW += it.ha;
    }
  }
  let dominant: Intensity | null = null;
  let best = 0;
  for (const k of LEVELS3)
    if (by[k].ha > best) {
      best = by[k].ha;
      dominant = k;
    }
  return {
    cells: items.length,
    area_ha: area,
    ndvi_mean: nW ? nSum / nW : null,
    by,
    dominant,
  };
}

export interface PolyAnalysis extends Summary {
  hits: CellHit[];
  masked: GeoGeometry | null; // bentuk polygon setelah masking ke petak
}

export function analyzePolygon(
  geometry: GeoGeometry,
  features: CellFeature[]
): PolyAnalysis {
  const subject = toMP(geometry);
  const [pw, ps, pe, pn] = bboxOf(geometry);
  const hits: CellHit[] = [];
  const pieces: Position[][][][] = [];

  for (const f of features) {
    const [w, s, e, n] = bboxOf(f.geometry);
    if (e < pw || w > pe || n < ps || s > pn) continue;
    try {
      const part = clip("intersection", subject, toMP(f.geometry));
      const pa = mpArea(part);
      if (!part.length || pa <= 0) continue;
      const ca = mpArea(toMP(f.geometry));
      const frac = ca > 0 ? Math.min(1, pa / ca) : 0;
      const g = asGeometry(part);
      if (!g) continue;
      pieces.push(part);
      hits.push({
        props: f.properties,
        geometry: g,
        frac,
        ha: frac * f.properties.area_ha,
      });
    } catch {
      /* geometri degenerat: lewati petak ini */
    }
  }

  let masked: GeoGeometry | null = null;
  if (pieces.length) {
    try {
      masked = asGeometry(
        pieces.length === 1
          ? pieces[0]
          : clip("union", pieces[0], ...pieces.slice(1))
      );
    } catch {
      masked = null;
    }
  }

  const sum = summarize(
    hits.map((h) => ({
      intensity: h.props.intensity,
      ndvi: h.props.ndvi_mean,
      ha: h.ha,
    }))
  );
  return { ...sum, hits, masked };
}

/* ---------- Ekspor KML berwarna + analisis ---------- */

const LEVEL_HEX: Record<LevelKey, string> = {
  rendah: "#3f8f6b",
  sedang: "#e0a83a",
  tinggi: "#c8442f",
  none: "#9aa0a6",
};
const LEVEL_NAME: Record<LevelKey, string> = {
  rendah: "Rendah",
  sedang: "Sedang",
  tinggi: "Tinggi",
  none: "Belum ada data NDVI",
};

// KML memakai warna aabbggrr.
const kmlColor = (hex: string, alpha: number) => {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}${b}${g}${r}`;
};

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ringKml = (ring: Ring) =>
  `<LinearRing><coordinates>${ring
    .map(([x, y]) => `${x},${y},0`)
    .join(" ")}</coordinates></LinearRing>`;

const polyKml = (rings: Ring[]) =>
  `<Polygon><outerBoundaryIs>${ringKml(rings[0])}</outerBoundaryIs>${rings
    .slice(1)
    .map((h) => `<innerBoundaryIs>${ringKml(h)}</innerBoundaryIs>`)
    .join("")}</Polygon>`;

const geomKml = (g: GeoGeometry) => {
  const ps = toMP(g);
  return ps.length === 1
    ? polyKml(ps[0])
    : `<MultiGeometry>${ps.map(polyKml).join("")}</MultiGeometry>`;
};

const fmt = (v: number | null, d = 2) => (v == null ? "-" : v.toFixed(d));

export function exportPolygonKml(
  polygon: PolygonItem,
  a: PolyAnalysis,
  rules: Rule[],
  surveyLabel?: string
) {
  const rule = rules.find((r) => r.intensity === a.dominant);
  const styles = (Object.keys(LEVEL_HEX) as LevelKey[])
    .map(
      (k) =>
        `<Style id="lvl-${k}"><LineStyle><color>${kmlColor(
          "#ffffff",
          0.85
        )}</color><width>0.8</width></LineStyle><PolyStyle><color>${kmlColor(
          LEVEL_HEX[k],
          0.55
        )}</color></PolyStyle></Style>`
    )
    .join("");

  const rows = LEVELS3.map(
    (k) =>
      `<tr><td>${LEVEL_NAME[k]}</td><td>${a.by[k].cells} petak</td><td>${fmt(
        a.by[k].ha
      )} ha</td></tr>`
  ).join("");
  const actions = rule
    ? `<p><b>Saran tindakan (intensitas ${LEVEL_NAME[
        a.dominant!
      ].toLowerCase()}):</b></p><ul>${rule.actions
        .map((x) => `<li>${esc(x.title)} (${esc(x.interval_label)})</li>`)
        .join("")}</ul>`
    : "";
  const desc = `<![CDATA[<h3>${esc(polygon.name)}</h3><p>Luas polygon: ${fmt(
    polygon.area_ha
  )} ha<br/>Luas terpetakan NDVI: ${fmt(
    a.area_ha
  )} ha<br/>NDVI rata-rata: ${fmt(a.ndvi_mean)}${
    surveyLabel ? `<br/>Survey: ${esc(surveyLabel)}` : ""
  }</p><table border="1" cellpadding="3">${rows}</table>${actions}<p><i>Bentuk polygon sudah di-masking: dipotong tepat pada petak 1 ha yang dicakupnya.</i></p>]]>`;

  const cells = a.hits
    .map((h) => {
      const k: LevelKey = h.props.intensity ?? "none";
      return `<Placemark><name>${esc(
        h.props.cell_id
      )}</name><description><![CDATA[Intensitas: ${
        LEVEL_NAME[k]
      }<br/>NDVI rata-rata: ${fmt(h.props.ndvi_mean)}<br/>Dalam polygon: ${fmt(
        h.ha
      )} ha (${Math.round(
        h.frac * 100
      )}% petak)]]></description><styleUrl>#lvl-${k}</styleUrl>${geomKml(
        h.geometry
      )}</Placemark>`;
    })
    .join("");

  const dom: LevelKey = a.dominant ?? "none";
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(
    polygon.name
  )}</name>${styles}<Style id="outline"><LineStyle><color>ff202020</color><width>2.2</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style><Placemark><name>${esc(
    polygon.name
  )} (hasil masking)</name><description>${desc}</description><styleUrl>#outline</styleUrl>${geomKml(
    a.masked ?? polygon.geometry
  )}</Placemark><Folder><name>Petak 1 ha dalam masking</name>${cells}</Folder></Document></kml>`;

  const blob = new Blob([kml], {
    type: "application/vnd.google-earth.kml+xml",
  });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `${
    polygon.name.replace(/[^\w-]+/g, "_") || "polygon"
  }-analisis.kml`;
  document.body.appendChild(el);
  el.click();
  el.remove();
  URL.revokeObjectURL(url);
}
