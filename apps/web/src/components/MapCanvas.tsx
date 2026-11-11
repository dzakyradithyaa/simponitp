"use client";

import maplibregl, { type GeoJSONSource, type Map as MLMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import type { Bounds, GeoGeometry, GridCollection, Intensity, PolygonItem, Position } from "@/lib/types";

// OpenStreetMap is the base map. The uploaded TIFF is served as a PMTiles archive (pmtiles:// protocol).
const OSM = process.env.NEXT_PUBLIC_TILES_STREETS || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: [OSM], tileSize: 256, maxzoom: 19, attribution: "&copy; OpenStreetMap contributors" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#dfe3d3" } },
    { id: "osm", type: "raster", source: "osm" },
  ],
};

let protocolReady = false;
function ensurePmtilesProtocol() {
  if (protocolReady) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  protocolReady = true;
}

const EMPTY = { type: "FeatureCollection", features: [] };
export interface LayerToggles { boundary: boolean; grid: boolean; ndvi: boolean; polygons: boolean }

interface Props {
  layers: LayerToggles;
  boundary: GeoGeometry | null;
  grid: GridCollection | null;
  selected: Set<string>;
  highlight: Intensity | null;
  tilesUrl: string | null; // absolute URL of the version's .pmtiles archive
  polygons: PolygonItem[];
  selectedPolygonId: number | null;
  mode: "petak" | "custom";
  drawing: boolean;
  draft: Position[];
  fit: { key: number; bounds: Bounds | null };
  onCellClick: (id: string) => void;
  onPolygonClick: (id: number) => void;
  onDrawPoint: (p: Position) => void;
}

function setData(map: MLMap, id: string, data: object) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data as Parameters<GeoJSONSource["setData"]>[0]);
}

export default function MapCanvas(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const live = useRef(props); // latest props for long-lived event handlers
  live.current = props;

  // --- create the map once ---
  useEffect(() => {
    if (!el.current) return;
    ensurePmtilesProtocol();
    const map = new maplibregl.Map({ container: el.current, style: STYLE, center: [118, -2.5], zoom: 4, attributionControl: { compact: true } });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      for (const id of ["boundary", "grid", "polys", "draft"]) map.addSource(id, { type: "geojson", data: EMPTY as never });
      map.addLayer({ id: "boundary-fill", type: "fill", source: "boundary", paint: { "fill-color": "#c9a227", "fill-opacity": 0.05 } });
      map.addLayer({ id: "boundary-line", type: "line", source: "boundary", paint: { "line-color": "#e8cf74", "line-width": 2.5 } });
      map.addLayer({
        id: "grid-fill", type: "fill", source: "grid",
        paint: {
          "fill-color": ["match", ["get", "intensity"], "rendah", "#4c8c4a", "sedang", "#e0a526", "tinggi", "#c0392b", "#9aa38a"],
          "fill-opacity": ["case", ["get", "selected"], 0.72, ["get", "dim"], 0.05, ["get", "has"], 0.5, 0.14],
        },
      });
      map.addLayer({
        id: "grid-line", type: "line", source: "grid",
        paint: {
          "line-color": ["case", ["get", "selected"], "#ffffff", "#f3e9b0"],
          "line-width": ["case", ["get", "selected"], 3, 1],
          "line-opacity": ["case", ["get", "dim"], 0.35, 1],
        },
      });
      map.addLayer({ id: "polys-fill", type: "fill", source: "polys", paint: { "fill-color": "#3aa6d9", "fill-opacity": ["case", ["get", "sel"], 0.5, 0.25] } });
      map.addLayer({ id: "polys-line", type: "line", source: "polys", paint: { "line-color": "#7fd0f5", "line-width": ["case", ["get", "sel"], 4, 2.5] } });
      map.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#f3e9b0", "fill-opacity": 0.25 } });
      map.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#f3e9b0", "line-width": 2.5, "line-dasharray": [2, 1.5] } });
      map.addLayer({ id: "draft-pts", type: "circle", source: "draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#a8841b", "circle-stroke-width": 2 } });
      setReady(true);
    });

    map.on("click", (e) => {
      const p = live.current;
      if (p.drawing) return p.onDrawPoint([e.lngLat.lng, e.lngLat.lat]);
      if (p.mode === "petak") {
        const f = map.queryRenderedFeatures(e.point, { layers: ["grid-fill"] })[0];
        if (f) p.onCellClick(String(f.properties?.cell_id));
      } else {
        const f = map.queryRenderedFeatures(e.point, { layers: ["polys-fill"] })[0];
        if (f) p.onPolygonClick(Number(f.properties?.id));
      }
    });
    map.on("mousemove", (e) => {
      const p = live.current;
      const layer = p.mode === "petak" ? "grid-fill" : "polys-fill";
      const over = !p.drawing && map.getLayer(layer) && map.queryRenderedFeatures(e.point, { layers: [layer] }).length > 0;
      map.getCanvas().style.cursor = p.drawing ? "crosshair" : over ? "pointer" : "";
    });

    return () => { map.remove(); mapRef.current = null; setReady(false); };
  }, []);

  const map = mapRef.current;

  // --- layer visibility ---
  useEffect(() => {
    if (!ready || !map) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    for (const id of ["boundary-fill", "boundary-line"]) map.setLayoutProperty(id, "visibility", vis(props.layers.boundary));
    for (const id of ["grid-fill", "grid-line"]) map.setLayoutProperty(id, "visibility", vis(props.layers.grid));
    for (const id of ["polys-fill", "polys-line"]) map.setLayoutProperty(id, "visibility", vis(props.layers.polygons));
    if (map.getLayer("ndvi")) map.setLayoutProperty("ndvi", "visibility", vis(props.layers.ndvi));
  }, [ready, map, props.layers]);

  // --- data layers ---
  useEffect(() => {
    if (!ready || !map) return;
    setData(map, "boundary", props.boundary ? { type: "Feature", properties: {}, geometry: props.boundary } : EMPTY);
  }, [ready, map, props.boundary]);

  useEffect(() => {
    if (!ready || !map) return;
    const features = (props.grid?.features ?? []).map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        selected: props.selected.has(f.properties.cell_id),
        has: f.properties.intensity !== null,
        dim: props.highlight !== null && f.properties.intensity !== props.highlight,
      },
    }));
    setData(map, "grid", { type: "FeatureCollection", features });
  }, [ready, map, props.grid, props.selected, props.highlight]);

  useEffect(() => {
    if (!ready || !map) return;
    setData(map, "polys", {
      type: "FeatureCollection",
      features: props.polygons.map((p) => ({ type: "Feature", properties: { id: p.id, sel: p.id === props.selectedPolygonId }, geometry: p.geometry })),
    });
  }, [ready, map, props.polygons, props.selectedPolygonId]);

  useEffect(() => {
    if (!ready || !map) return;
    const pts = props.draft;
    const features: object[] = pts.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }));
    if (pts.length >= 2) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.length >= 3 ? [...pts, pts[0]] : pts } });
    if (pts.length >= 3) features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] } });
    setData(map, "draft", { type: "FeatureCollection", features });
  }, [ready, map, props.draft]);

  // --- uploaded TIFF as a PMTiles raster layer ---
  useEffect(() => {
    if (!ready || !map) return;
    if (map.getLayer("ndvi")) map.removeLayer("ndvi");
    if (map.getSource("ndvi")) map.removeSource("ndvi");
    if (!props.tilesUrl) return;
    map.addSource("ndvi", { type: "raster", url: `pmtiles://${props.tilesUrl}`, tileSize: 256 });
    map.addLayer({ id: "ndvi", type: "raster", source: "ndvi", paint: { "raster-opacity": 0.6, "raster-fade-duration": 0 },
                   layout: { visibility: live.current.layers.ndvi ? "visible" : "none" } }, "boundary-fill");
  }, [ready, map, props.tilesUrl]);

  // --- drawing ergonomics ---
  useEffect(() => {
    if (!map) return;
    if (props.drawing) map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
  }, [map, props.drawing]);

  // --- camera ---
  useEffect(() => {
    if (!ready || !map || !props.fit.bounds) return;
    const [w, s, e, n] = props.fit.bounds;
    map.fitBounds([[w, s], [e, n]], { padding: 48, duration: 600, maxZoom: 18.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, map, props.fit.key]);

  // inline style: maplibre-gl.css sets .maplibregl-map { position: relative }, which would beat a utility class
  return <div ref={el} style={{ position: "absolute", inset: 0 }} role="application" aria-label="Peta lahan" />;
}
