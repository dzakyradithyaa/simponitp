"use client";

import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MLMap,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { LockSimple, LockSimpleOpen } from "@phosphor-icons/react";
import {
  ESRI_MAXZOOM,
  SAT_HD_ATTR,
  SAT_HD_MAXZOOM,
  SAT_HD_URL,
} from "@/lib/basemap";
import type { Basemap } from "@/lib/basemap";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import type {
  Bounds,
  GeoGeometry,
  GridCollection,
  Intensity,
  PolygonItem,
  Position,
} from "@/lib/types";

maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString()
);

// OpenStreetMap is the base map. The uploaded TIFF is served as a PMTiles archive (pmtiles:// protocol).
const OSM =
  process.env.NEXT_PUBLIC_TILES_STREETS ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const HD_SOURCE: StyleSpecification["sources"] = SAT_HD_URL
  ? {
      hd: {
        type: "raster",
        tiles: [SAT_HD_URL],
        tileSize: 256,
        maxzoom: SAT_HD_MAXZOOM,
        attribution: SAT_HD_ATTR,
      },
    }
  : {};
const HD_LAYERS: StyleSpecification["layers"] = SAT_HD_URL
  ? [{ id: "hd", type: "raster", source: "hd", layout: { visibility: "none" } }]
  : [];

const STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    ...HD_SOURCE,
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: ESRI_MAXZOOM,
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
    osm: {
      type: "raster",
      tiles: [OSM],
      tileSize: 256,
      maxzoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#eef0f2" } },
    { id: "osm", type: "raster", source: "osm" },
    {
      id: "esri",
      type: "raster",
      source: "esri",
      layout: { visibility: "none" },
    },
    ...HD_LAYERS,
  ],
};

let protocolReady = false;
function ensurePmtilesProtocol() {
  if (protocolReady) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  protocolReady = true;
}

const EMPTY = { type: "FeatureCollection", features: [] };
export interface LayerToggles {
  boundary: boolean;
  grid: boolean;
  ndvi: boolean;
  polygons: boolean;
  labels: boolean;
}

interface Props {
  layers: LayerToggles;
  boundary: GeoGeometry | null;
  grid: GridCollection | null;
  selected: Set<string>;
  highlight: Intensity | null;
  tilesUrl: string | null; // absolute URL of the version's .pmtiles archive
  polygons: PolygonItem[];
  polygonIntensity?: Record<number, Intensity | null>;
  selectedPolygonId: number | null;
  rasterOpacity?: number;
  basemap?: Basemap;
  compassClass?: string; // posisi kompas (kelas Tailwind, mis. "right-3")
  pinSets?: { id: number; coords: Position[] }[]; // titik sudut polygon custom
  editing?: Position[] | null; // ring terbuka (tanpa titik penutup) yang sedang diedit
  onEditChange?: (ring: Position[]) => void;
  pin?: {
    key: number;
    lng: number;
    lat: number;
    kind: "search" | "me";
    bounds?: Bounds | null;
  } | null;
  mode: "petak" | "custom";
  drawing: boolean;
  draft: Position[];
  fit: { key: number; bounds: Bounds | null };
  onCellClick: (id: string, coords: Position) => void;
  cellPopup?: { lng: number; lat: number; content: ReactNode } | null;
  onPolygonClick: (id: number) => void;
  onDrawPoint: (p: Position) => void;
}

function setData(map: MLMap, id: string, data: object) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(
    data as Parameters<GeoJSONSource["setData"]>[0]
  );
}

// Pin 3D berdiri: kepala bola berkilau, jarum logam, dan bayangan di tanah.
const PIN_SVG = `<svg width="28" height="46" viewBox="0 0 28 46" aria-hidden="true">
<defs>
<radialGradient id="pin-hl" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>
<linearGradient id="pin-nd" x1="0" x2="1"><stop offset="0" stop-color="#f2f2f2"/><stop offset=".5" stop-color="#9a9a9a"/><stop offset="1" stop-color="#4a4a4a"/></linearGradient>
<radialGradient id="pin-sh"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="14" cy="41" rx="8" ry="2.6" fill="url(#pin-sh)"/>
<path d="M12.6 21 L15.4 21 L14 41 Z" fill="url(#pin-nd)"/>
<circle cx="14" cy="12" r="10" style="fill:var(--pin)"/>
<circle cx="14" cy="12" r="10" fill="url(#pin-hl)"/>
<ellipse cx="10.6" cy="7.6" rx="2.6" ry="1.7" fill="#fff" fill-opacity=".75" transform="rotate(-28 10.6 7.6)"/>
</svg>`;

function makePin(
  sel: boolean,
  opts: { label?: string; interactive?: boolean } = {}
): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width:28px;height:46px;pointer-events:${
    opts.interactive ? "auto" : "none"
  };${opts.interactive ? "cursor:grab;" : ""}`;
  el.style.setProperty("--pin", sel ? "#D71920" : "#2b2b2b");
  const inner = document.createElement("div");
  inner.style.cssText = "width:100%;height:100%";
  inner.innerHTML = opts.label
    ? PIN_SVG.replace(
        "</svg>",
        `<text x="14" y="15.2" text-anchor="middle" font-size="9" font-weight="700" fill="#fff" style="font-family:'DM Sans',system-ui,sans-serif">${opts.label}</text></svg>`
      )
    : PIN_SVG;
  el.appendChild(inner);
  inner.animate(
    [
      { transform: "translateY(-18px) scale(.6)", opacity: 0 },
      { transform: "translateY(0) scale(1)", opacity: 1 },
    ],
    { duration: 420, easing: "cubic-bezier(0.32,0.72,0,1)" }
  );
  return el;
}

// Teks ukuran petak: petak penuh = sisi grid, petak tepi = perkiraan dari kotak batasnya.
function cellSize(f: GridCollection["features"][number], m: number): string {
  if (f.properties.is_full) return `${Math.round(m)} × ${Math.round(m)} m`;
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  const polys =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
  for (const rings of polys)
    for (const [x, y] of rings[0]) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
  const wm = (e - w) * 111320 * Math.cos((((s + n) / 2) * Math.PI) / 180);
  const hm = (n - s) * 110540;
  return `≈ ${Math.round(wm)} × ${Math.round(hm)} m`;
}

export default function MapCanvas(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const pinRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkers = useRef(
    new Map<string, { m: maplibregl.Marker; el: HTMLElement }>()
  );
  const editMarkers = useRef<maplibregl.Marker[]>([]);
  const draggingEdit = useRef<number | null>(null);
  const [bearing, setBearing] = useState(0);
  const [lock, setLock] = useState(false);
  const [ready, setReady] = useState(false);
  const live = useRef(props); // latest props for long-lived event handlers
  live.current = props;
  const popupRoot = useRef<Root | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const target = props.cellPopup;
    if (!map || !target || !ready) {
      popupRoot.current?.unmount();
      popupRoot.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }
    const container = document.createElement("div");
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: "320px",
      className: "analysis-map-popup",
    })
      .setLngLat([target.lng, target.lat])
      .setDOMContent(container)
      .addTo(map);
    const root = createRoot(container);
    popupRoot.current = root;
    popupRef.current = popup;
    return () => {
      root.unmount();
      popupRoot.current = null;
      popupRef.current = null;
      popup.remove();
    };
  }, [props.cellPopup?.lng, props.cellPopup?.lat, ready]);

  useEffect(() => {
    if (props.cellPopup) popupRoot.current?.render(props.cellPopup.content);
  }, [props.cellPopup?.content]);

  // --- create the map once ---
  useEffect(() => {
    if (!el.current) return;
    ensurePmtilesProtocol();
    const map = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [118, -2.5],
      zoom: 4,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );
    map.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left"
    );

    map.on("load", () => {
      for (const id of [
        "boundary",
        "grid",
        "polys",
        "draft",
        "edit",
        "editmid",
      ])
        map.addSource(id, { type: "geojson", data: EMPTY as never });
      map.addLayer({
        id: "boundary-fill",
        type: "fill",
        source: "boundary",
        paint: { "fill-color": "#202020", "fill-opacity": 0.03 },
      });
      map.addLayer({
        id: "boundary-line",
        type: "line",
        source: "boundary",
        paint: { "line-color": "#202020", "line-width": 1.6 },
      });
      map.addLayer({
        id: "grid-fill",
        type: "fill",
        source: "grid",
        paint: {
          "fill-color": [
            "match",
            ["get", "intensity"],
            "rendah",
            "#3f8f6b",
            "sedang",
            "#e0a83a",
            "tinggi",
            "#c8442f",
            "#9aa0a6",
          ],
          "fill-opacity": [
            "case",
            ["get", "selected"],
            0.72,
            ["get", "dim"],
            0.05,
            ["get", "has"],
            0.5,
            0.14,
          ],
        },
      });
      map.addLayer({
        id: "grid-line",
        type: "line",
        source: "grid",
        paint: {
          "line-color": ["case", ["get", "selected"], "#202020", "#ffffff"],
          "line-width": ["case", ["get", "selected"], 2, 0.5],
          "line-opacity": ["case", ["get", "dim"], 0.25, 0.7],
        },
      });
      map.addLayer({
        id: "grid-label",
        type: "symbol",
        source: "grid",
        minzoom: 16.5,
        layout: {
          "text-field": ["get", "size"],
          "text-font": ["Open Sans Regular"],
          "text-size": 10,
        },
        paint: {
          "text-color": "#202020",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.6,
        },
      });
      map.addLayer({
        id: "polys-fill",
        type: "fill",
        source: "polys",
        paint: {
          "fill-color": [
            "match",
            ["get", "intensity"],
            "rendah",
            "#3f8f6b",
            "sedang",
            "#e0a83a",
            "tinggi",
            "#c8442f",
            "#9aa0a6",
          ],
          "fill-opacity": ["case", ["get", "sel"], 0.62, 0.5],
        },
      });
      map.addLayer({
        id: "polys-casing",
        type: "line",
        source: "polys",
        paint: {
          "line-color": "#ffffff",
          "line-width": ["case", ["get", "sel"], 4, 3],
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "polys-line",
        type: "line",
        source: "polys",
        paint: {
          "line-color": ["case", ["get", "sel"], "#D71920", "#202020"],
          "line-width": ["case", ["get", "sel"], 1.8, 1.1],
        },
      });
      map.addLayer({
        id: "draft-fill",
        type: "fill",
        source: "draft",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#d71920", "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: "draft-line",
        type: "line",
        source: "draft",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#d71920",
          "line-width": 2,
          "line-dasharray": [2, 1.5],
        },
      });
      map.addLayer({
        id: "draft-pts",
        type: "circle",
        source: "draft",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#d71920",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "edit-line",
        type: "line",
        source: "edit",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#D71920",
          "line-width": 1.6,
          "line-dasharray": [2, 1.5],
        },
      });
      map.addLayer({
        id: "edit-mid",
        type: "circle",
        source: "editmid",
        paint: {
          "circle-radius": 3.5,
          "circle-color": "#D71920",
          "circle-opacity": 0.55,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "edit-vtx",
        type: "circle",
        source: "edit",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5.5,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#D71920",
          "circle-stroke-width": 2,
        },
      });
      map.setLayoutProperty("draft-pts", "visibility", "none");
      map.setLayoutProperty("edit-vtx", "visibility", "none");
      setReady(true);
    });

    map.on("click", (e) => {
      const p = live.current;
      if (p.editing) {
        const m = map.queryRenderedFeatures(e.point, {
          layers: ["edit-mid"],
        })[0];
        if (m && p.onEditChange) {
          const i = Number(m.properties?.idx);
          const c = (m.geometry as unknown as { coordinates: Position })
            .coordinates;
          const r = p.editing.slice();
          r.splice(i + 1, 0, [c[0], c[1]]);
          p.onEditChange(r);
        }
        return;
      }
      if (p.drawing) return p.onDrawPoint([e.lngLat.lng, e.lngLat.lat]);
      if (p.mode === "petak") {
        const f = map.queryRenderedFeatures(e.point, {
          layers: ["grid-fill"],
        })[0];
        if (f)
          p.onCellClick(String(f.properties?.cell_id), [
            e.lngLat.lng,
            e.lngLat.lat,
          ]);
      } else {
        const f = map.queryRenderedFeatures(e.point, {
          layers: ["polys-fill"],
        })[0];
        if (f) p.onPolygonClick(Number(f.properties?.id));
      }
    });
    map.on("mousemove", (e) => {
      const p = live.current;
      if (p.editing) return;
      const layer = p.mode === "petak" ? "grid-fill" : "polys-fill";
      const over =
        !p.drawing &&
        map.getLayer(layer) &&
        map.queryRenderedFeatures(e.point, { layers: [layer] }).length > 0;
      map.getCanvas().style.cursor = p.drawing
        ? "crosshair"
        : over
        ? "pointer"
        : "";
    });

    // --- edit vektor: seret titik, klik titik tengah untuk menambah, klik kanan / dobel klik untuk menghapus ---
    let dragIdx: number | null = null;
    const startDrag = (
      e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent
    ) => {
      const f = map.queryRenderedFeatures(e.point, {
        layers: ["edit-vtx"],
      })[0];
      if (!f) return;
      e.preventDefault();
      dragIdx = Number(f.properties?.idx);
      map.dragPan.disable();
      map.getCanvas().style.cursor = "grabbing";
    };
    const moveDrag = (
      e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent
    ) => {
      if (dragIdx == null) return;
      const p = live.current;
      if (!p.editing || !p.onEditChange) return;
      const r = p.editing.slice();
      r[dragIdx] = [e.lngLat.lng, e.lngLat.lat];
      p.onEditChange(r);
    };
    const endDrag = () => {
      if (dragIdx == null) return;
      dragIdx = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = "grab";
    };
    const delVertex = (
      e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent
    ) => {
      const p = live.current;
      const f = map.queryRenderedFeatures(e.point, {
        layers: ["edit-vtx"],
      })[0];
      if (!f || !p.editing || !p.onEditChange || p.editing.length <= 3) return;
      e.preventDefault();
      const r = p.editing.slice();
      r.splice(Number(f.properties?.idx), 1);
      p.onEditChange(r);
    };
    map.on("mousedown", "edit-vtx", startDrag);
    map.on("touchstart", "edit-vtx", startDrag);
    map.on("mousemove", moveDrag);
    map.on("touchmove", moveDrag);
    map.on("mouseup", endDrag);
    map.on("touchend", endDrag);
    map.on("contextmenu", "edit-vtx", delVertex);
    map.on("dblclick", "edit-vtx", delVertex);
    map.on("mouseenter", "edit-vtx", () => {
      if (dragIdx == null) map.getCanvas().style.cursor = "grab";
    });
    map.on("mouseleave", "edit-vtx", () => {
      if (dragIdx == null) map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "edit-mid", () => {
      map.getCanvas().style.cursor = "copy";
    });
    map.on("mouseleave", "edit-mid", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("rotate", () => setBearing(map.getBearing()));

    return () => {
      editMarkers.current.forEach((mk) => mk.remove());
      editMarkers.current.length = 0;
      pinMarkers.current.forEach((v) => v.m.remove());
      pinMarkers.current.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  const map = mapRef.current;

  // --- layer visibility ---
  useEffect(() => {
    if (!ready || !map) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    for (const id of ["boundary-fill", "boundary-line"])
      map.setLayoutProperty(id, "visibility", vis(props.layers.boundary));
    if (map.getLayer("grid-label"))
      map.setLayoutProperty(
        "grid-label",
        "visibility",
        vis(props.layers.grid && props.layers.labels)
      );
    for (const id of ["grid-fill", "grid-line"])
      map.setLayoutProperty(id, "visibility", vis(props.layers.grid));
    for (const id of ["polys-fill", "polys-casing", "polys-line"])
      map.setLayoutProperty(id, "visibility", vis(props.layers.polygons));
    if (map.getLayer("ndvi"))
      map.setLayoutProperty("ndvi", "visibility", vis(props.layers.ndvi));
  }, [ready, map, props.layers]);

  // --- data layers ---
  useEffect(() => {
    if (!ready || !map) return;
    setData(
      map,
      "boundary",
      props.boundary
        ? { type: "Feature", properties: {}, geometry: props.boundary }
        : EMPTY
    );
  }, [ready, map, props.boundary]);

  useEffect(() => {
    if (!ready || !map) return;
    const features = (props.grid?.features ?? []).map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        size: cellSize(f, props.grid?.cell_size_m ?? 100),
        selected: props.selected.has(f.properties.cell_id),
        has: f.properties.intensity !== null,
        dim:
          props.highlight !== null &&
          f.properties.intensity !== props.highlight,
      },
    }));
    setData(map, "grid", { type: "FeatureCollection", features });
  }, [ready, map, props.grid, props.selected, props.highlight]);

  useEffect(() => {
    if (!ready || !map) return;
    setData(map, "polys", {
      type: "FeatureCollection",
      features: props.polygons.map((p) => ({
        type: "Feature",
        properties: {
          id: p.id,
          sel: p.id === props.selectedPolygonId,
          intensity: props.polygonIntensity?.[p.id] ?? "none",
        },
        geometry: p.geometry,
      })),
    });
  }, [
    ready,
    map,
    props.polygons,
    props.selectedPolygonId,
    props.polygonIntensity,
  ]);

  useEffect(() => {
    if (!ready || !map) return;
    const pts = props.draft;
    const features: object[] = pts.map((c) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: c },
    }));
    if (pts.length >= 2)
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: pts.length >= 3 ? [...pts, pts[0]] : pts,
        },
      });
    if (pts.length >= 3)
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] },
      });
    setData(map, "draft", { type: "FeatureCollection", features });
  }, [ready, map, props.draft]);

  // --- uploaded TIFF as a PMTiles raster layer ---
  useEffect(() => {
    if (!ready || !map) return;
    if (map.getLayer("ndvi")) map.removeLayer("ndvi");
    if (map.getSource("ndvi")) map.removeSource("ndvi");
    if (!props.tilesUrl) return;
    map.addSource("ndvi", {
      type: "raster",
      url: `pmtiles://${props.tilesUrl}`,
      tileSize: 256,
    });
    map.addLayer(
      {
        id: "ndvi",
        type: "raster",
        source: "ndvi",
        paint: {
          "raster-opacity": live.current.rasterOpacity ?? 0.6,
          "raster-fade-duration": 0,
        },
        layout: { visibility: live.current.layers.ndvi ? "visible" : "none" },
      },
      "boundary-fill"
    );
  }, [ready, map, props.tilesUrl]);

  // --- drawing ergonomics ---
  useEffect(() => {
    if (!map) return;
    if (props.drawing || props.editing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [map, props.drawing, props.editing]);

  // --- kunci arah utara ---
  useEffect(() => {
    if (!ready || !map) return;
    if (lock) {
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
    } else {
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
    }
  }, [ready, map, lock]);

  // --- pin 3D di tiap titik sudut polygon custom (dan titik yang sedang digambar) ---
  useEffect(() => {
    if (!ready || !map) return;
    const want = new Map<
      string,
      { c: Position; sel: boolean; label?: string }
    >();
    if (props.mode === "custom") {
      if (props.layers.polygons)
        for (const set of props.pinSets ?? [])
          set.coords.forEach((c, i) =>
            want.set(`p${set.id}:${i}:${c[0]}:${c[1]}`, {
              c,
              sel: set.id === props.selectedPolygonId,
            })
          );
      props.draft.forEach((c, i) =>
        want.set(`d${i}:${c[0]}:${c[1]}`, {
          c,
          sel: true,
          label: String(i + 1),
        })
      );
    }
    for (const [k, v] of pinMarkers.current)
      if (!want.has(k)) {
        v.m.remove();
        pinMarkers.current.delete(k);
      }
    for (const [k, w] of want) {
      const ex = pinMarkers.current.get(k);
      if (ex) {
        ex.el.style.setProperty("--pin", w.sel ? "#D71920" : "#2b2b2b");
        continue;
      }
      const el = makePin(w.sel, { label: w.label });
      const marker = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
        offset: [0, 5],
      })
        .setLngLat(w.c)
        .addTo(map);
      pinMarkers.current.set(k, { m: marker, el });
    }
  }, [
    ready,
    map,
    props.mode,
    props.layers.polygons,
    props.pinSets,
    props.selectedPolygonId,
    props.draft,
  ]);

  // --- pin 3D yang bisa diseret saat mengedit polygon ---
  useEffect(() => {
    if (!ready || !map) return;
    const ring = props.editing;
    const list = editMarkers.current;
    if (!ring || ring.length < 3) {
      list.forEach((mk) => mk.remove());
      list.length = 0;
      return;
    }
    while (list.length > ring.length) list.pop()?.remove();
    while (list.length < ring.length) {
      const i = list.length;
      const el = makePin(true, { label: String(i + 1), interactive: true });
      const mk = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
        offset: [0, 5],
        draggable: true,
      })
        .setLngLat(ring[i])
        .addTo(map);
      mk.on("dragstart", () => {
        draggingEdit.current = i;
      });
      mk.on("drag", () => {
        const p = live.current;
        if (!p.editing || !p.onEditChange) return;
        const ll = mk.getLngLat();
        const r = p.editing.slice();
        r[i] = [ll.lng, ll.lat];
        p.onEditChange(r);
      });
      mk.on("dragend", () => {
        draggingEdit.current = null;
      });
      const del = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const p = live.current;
        if (!p.editing || !p.onEditChange || p.editing.length <= 3) return;
        const r = p.editing.slice();
        r.splice(i, 1);
        p.onEditChange(r);
      };
      el.addEventListener("contextmenu", del);
      el.addEventListener("dblclick", del);
      list.push(mk);
    }
    ring.forEach((c, i) => {
      if (draggingEdit.current !== i) list[i].setLngLat(c);
      const t = list[i].getElement().querySelector("text");
      if (t) t.textContent = String(i + 1);
    });
  }, [ready, map, props.editing]);

  // --- peta dasar: jalan (OSM), satelit (Esri), atau satelit HD (opsional) ---
  useEffect(() => {
    if (!ready || !map) return;
    const b = props.basemap ?? "osm";
    map.setLayoutProperty(
      "osm",
      "visibility",
      b === "osm" ? "visible" : "none"
    );
    map.setLayoutProperty(
      "esri",
      "visibility",
      b === "satellite" ? "visible" : "none"
    );
    if (map.getLayer("hd"))
      map.setLayoutProperty(
        "hd",
        "visibility",
        b === "hd" ? "visible" : "none"
      );
    map.setPaintProperty(
      "boundary-line",
      "line-color",
      b === "osm" ? "#202020" : "#ffffff"
    );
  }, [ready, map, props.basemap]);

  // --- opacity raster TIFF ---
  useEffect(() => {
    if (!ready || !map || !map.getLayer("ndvi")) return;
    map.setPaintProperty("ndvi", "raster-opacity", props.rasterOpacity ?? 0.6);
  }, [ready, map, props.rasterOpacity, props.tilesUrl]);

  // --- titik edit vektor ---
  useEffect(() => {
    if (!ready || !map) return;
    const r = props.editing;
    if (!r || r.length < 3) {
      setData(map, "edit", EMPTY);
      setData(map, "editmid", EMPTY);
      return;
    }
    const features: object[] = [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [...r, r[0]] },
      },
      ...r.map((c, idx) => ({
        type: "Feature",
        properties: { idx },
        geometry: { type: "Point", coordinates: c },
      })),
    ];
    const mids = r.map((c, idx) => {
      const n = r[(idx + 1) % r.length];
      return {
        type: "Feature",
        properties: { idx },
        geometry: {
          type: "Point",
          coordinates: [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2],
        },
      };
    });
    setData(map, "edit", { type: "FeatureCollection", features });
    setData(map, "editmid", { type: "FeatureCollection", features: mids });
  }, [ready, map, props.editing]);

  // --- penanda hasil pencarian / lokasi saya ---
  useEffect(() => {
    if (!ready || !map) return;
    pinRef.current?.remove();
    pinRef.current = null;
    const pin = props.pin;
    if (!pin) return;
    const el = document.createElement("div");
    el.style.cssText =
      pin.kind === "me"
        ? "width:16px;height:16px;border-radius:9999px;background:#1a73e8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(26,115,232,.25),0 1px 4px rgba(0,0,0,.35)"
        : "width:18px;height:18px;border-radius:9999px;background:#D71920;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)";
    pinRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
    if (pin.bounds) {
      const [w, s, e, n] = pin.bounds;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 64, duration: 700, maxZoom: 16 }
      );
    } else {
      map.flyTo({ center: [pin.lng, pin.lat], zoom: 16, duration: 700 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, map, props.pin?.key]);

  // --- camera ---
  useEffect(() => {
    if (!ready || !map || !props.fit.bounds) return;
    const [w, s, e, n] = props.fit.bounds;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 48, duration: 600, maxZoom: 18.5 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, map, props.fit.key]);

  // inline style: maplibre-gl.css sets .maplibregl-map { position: relative }, which would beat a utility class
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        ref={el}
        style={{ position: "absolute", inset: 0 }}
        role="application"
        aria-label="Peta lahan"
      />
      <div
        className={`absolute top-3 z-10 flex flex-col items-center gap-1.5 transition-[right] duration-[420ms] ease-apple ${
          props.compassClass ?? "right-3"
        }`}
      >
        <button
          type="button"
          onClick={() =>
            mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 600 })
          }
          aria-label="Arahkan peta ke utara"
          title="Hadap utara"
          className="grid h-9 w-9 place-items-center rounded-full border border-[#e6e6e6] bg-white shadow-[0_4px_16px_rgba(32,32,32,0.14)] transition-colors hover:border-[#D71920] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            style={{ transform: `rotate(${-bearing}deg)` }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10.5" fill="none" stroke="#e2e2e2" />
            <path d="M12 3.5 L15.2 12 H8.8 Z" fill="#D71920" />
            <path d="M12 20.5 L8.8 12 H15.2 Z" fill="#9a9a9a" />
            <circle cx="12" cy="12" r="1.3" fill="#fff" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setLock((l) => !l)}
          aria-pressed={lock}
          aria-label="Kunci arah utara"
          title={
            lock
              ? "Auto utara aktif (klik untuk melepas)"
              : "Auto utara: kunci peta menghadap utara"
          }
          className={`grid h-7 w-7 place-items-center rounded-full border shadow-[0_4px_16px_rgba(32,32,32,0.14)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920] ${
            lock
              ? "border-[#D71920] bg-[#D71920] text-white"
              : "border-[#e6e6e6] bg-white text-[#202020] hover:border-[#D71920]"
          }`}
        >
          {lock ? (
            <LockSimple className="h-3.5 w-3.5" />
          ) : (
            <LockSimpleOpen className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
