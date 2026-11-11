export type Role = "user" | "admin";
export type Intensity = "rendah" | "sedang" | "tinggi";
export type Bounds = [number, number, number, number]; // west, south, east, north

export interface User {
  id: number; username: string; full_name: string; role: Role; is_active: boolean;
  created_at: string; last_login_at: string | null;
}
export interface SessionInfo { user: User; idle_timeout_seconds: number }

export interface MapVersion {
  id: number; map_id: number; version: number; label: string; notes: string | null;
  status: "processing" | "ready" | "failed"; error: string | null; original_filename: string;
  bounds: Bounds | null; stats: { min: number; max: number; mean: number } | null;
  is_active: boolean; created_at: string; has_tiles: boolean;
}
export interface MapItem {
  id: number; name: string; description: string | null; has_boundary: boolean; area_ha: number | null;
  bounds: Bounds | null; created_at: string; updated_at: string; versions: MapVersion[];
  boundary?: GeoGeometry;
}

export type Position = [number, number];
export type GeoGeometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

export interface CellProps {
  cell_id: string; row: number; col: number; area_ha: number; is_full: boolean;
  ndvi_mean: number | null; ndvi_min: number | null; ndvi_max: number | null; intensity: Intensity | null;
}
export interface CellFeature { type: "Feature"; id: string; geometry: GeoGeometry; properties: CellProps }
export interface IntensityBucket { cells: number; area_ha: number }
export interface GridSummary {
  cells: number; area_ha: number; ndvi_mean: number | null;
  by_intensity: Record<Intensity | "none", IntensityBucket>;
}
export interface GridCollection {
  type: "FeatureCollection"; features: CellFeature[]; summary: GridSummary;
  version: { id: number; label: string; status: string } | null; cell_size_m: number;
}

export interface RuleAction {
  type: string; title: string; detail: string; level: Intensity; interval_days: number; interval_label: string;
}
export interface Rule {
  intensity: Intensity; label: string; color: string; ndvi_min: number | null; ndvi_max: number | null;
  actions: RuleAction[]; notes: string | null;
}
export interface Analysis {
  intensity: Intensity; rule: Rule; cell_ids: string[]; cells: number; area_ha: number;
  disclaimer: string; has_ndvi: boolean;
}

export interface PolygonItem {
  id: number; map_id: number; name: string; note: string | null; area_ha: number; owner: string | null;
  created_at: string; coverage_pct: number | null; geometry: GeoGeometry;
}

export interface DashboardSummary {
  maps: number; total_area_ha: number; my_polygons: number; versions: number; active_users?: number;
  featured: null | {
    id: number; name: string; summary: GridSummary;
    version: null | { id: number; label: string; created_at: string };
  };
}

export interface AdminUserRow {
  id: number; username: string; full_name: string; role: Role; is_active: boolean;
  last_login_at: string | null; logins: number; uploads: number; polygons: number; exports: number;
}
export interface ActivityItem {
  id: number; user_id: number | null; username: string; action: string; detail: string | null; created_at: string;
}
