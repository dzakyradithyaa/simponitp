"use client";

import maplibregl, {
  type GeoJSONSource,
  type Map as MLMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import type {
  Bounds,
  GeoGeometry,
  GridCollection,
  Intensity,
  PolygonItem,
  Position,
} from "@/lib/types";

// OpenStreetMap is the base map. The uploaded TIFF is served as a PMTiles archive (pmtiles:// protocol).
const OSM =
  process.env.NEXT_PUBLIC_TILES_STREETS ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
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
  basemap?: "osm" | "satellite";
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
  onCellClick: (id: string) => void;
  onPolygonClick: (id: number) => void;
  onDrawPoint: (p: Position) => void;
}

function setData(map: MLMap, id: string, data: object) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(
    data as Parameters<GeoJSONSource["setData"]>[0]
  );
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
  const [ready, setReady] = useState(false);
  const live = useRef(props); // latest props for long-lived event handlers
  live.current = props;

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
        if (f) p.onCellClick(String(f.properties?.cell_id));
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

    return () => {
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

  // --- peta dasar: jalan (OSM) atau satelit (Esri) ---
  useEffect(() => {
    if (!ready || !map) return;
    const sat = props.basemap === "satellite";
    map.setLayoutProperty("osm", "visibility", sat ? "none" : "visible");
    map.setLayoutProperty("esri", "visibility", sat ? "visible" : "none");
    map.setPaintProperty(
      "boundary-line",
      "line-color",
      sat ? "#ffffff" : "#202020"
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
    <div
      ref={el}
      style={{ position: "absolute", inset: 0 }}
      role="application"
      aria-label="Peta lahan"
    />
  );
}
