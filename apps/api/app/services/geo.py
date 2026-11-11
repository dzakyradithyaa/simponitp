"""Geometry helpers: metric projection, 1-ha grid generation, polygon validation."""
from __future__ import annotations

import math
from dataclasses import dataclass

from pyproj import CRS, Transformer
from shapely import make_valid
from shapely.geometry import MultiPolygon, Polygon, box, mapping, shape
from shapely.ops import transform
from shapely.prepared import prep


class GeoError(ValueError):
    """Raised for user-facing geometry problems (message is shown to the user)."""


def utm_crs_for(geom) -> CRS:
    c = geom.centroid
    zone = int((c.x + 180) // 6) + 1
    return CRS.from_epsg((32600 if c.y >= 0 else 32700) + min(max(zone, 1), 60))


def _transformers(crs: CRS):
    fwd = Transformer.from_crs(4326, crs, always_xy=True).transform
    inv = Transformer.from_crs(crs, 4326, always_xy=True).transform
    return fwd, inv


def area_ha(geom_wgs84) -> float:
    fwd, _ = _transformers(utm_crs_for(geom_wgs84))
    return transform(fwd, geom_wgs84).area / 10_000.0


def polygonal(geom):
    """Keep only polygonal parts of a geometry; return Polygon/MultiPolygon or None."""
    if geom is None or geom.is_empty:
        return None
    if isinstance(geom, (Polygon, MultiPolygon)):
        return geom
    parts = [g for g in getattr(geom, "geoms", []) if isinstance(g, (Polygon, MultiPolygon))]
    flat: list[Polygon] = []
    for p in parts:
        flat.extend(p.geoms if isinstance(p, MultiPolygon) else [p])
    if not flat:
        return None
    return flat[0] if len(flat) == 1 else MultiPolygon(flat)


def clean_geometry(geom):
    """Force 2D, repair if invalid, keep polygonal parts only."""
    from shapely import force_2d

    geom = force_2d(geom)
    if not geom.is_valid:
        geom = make_valid(geom)
    geom = polygonal(geom)
    if geom is None or geom.area == 0:
        raise GeoError("Geometri tidak berisi area poligon yang valid.")
    minx, miny, maxx, maxy = geom.bounds
    if minx < -180 or maxx > 180 or miny < -90 or maxy > 90:
        raise GeoError("Koordinat di luar rentang lon/lat (EPSG:4326). Pastikan file memakai WGS84.")
    return geom


def to_multipolygon(geom) -> MultiPolygon:
    return geom if isinstance(geom, MultiPolygon) else MultiPolygon([geom])


def polygon_from_geojson(geojson: dict) -> Polygon:
    if not isinstance(geojson, dict) or geojson.get("type") != "Polygon":
        raise GeoError("Geometri harus bertipe Polygon.")
    try:
        poly = shape(geojson)
    except Exception as exc:  # noqa: BLE001
        raise GeoError("GeoJSON polygon tidak valid.") from exc
    geom = clean_geometry(poly)
    if isinstance(geom, MultiPolygon):
        geom = max(geom.geoms, key=lambda g: g.area)  # keep the dominant part after repair
    return geom


@dataclass
class Cell:
    cell_id: str
    row: int
    col: int
    geom: Polygon | MultiPolygon  # WGS84, clipped to the source area
    area_ha: float
    is_full: bool


def generate_grid(area_wgs84, cell_size_m: int = 100, min_coverage: float = 0.05, max_cells: int = 20000) -> list[Cell]:
    """Split an area into square blocks of cell_size_m (default 100 x 100 m = 1 ha).

    The grid is axis-aligned in the local UTM zone and anchored on multiples of the cell
    size, rows count from north to south and columns from west to east (cell id R{row}C{col}).
    Blocks are clipped to the area; blocks covering less than `min_coverage` of a full block
    are dropped.
    """
    if not 10 <= cell_size_m <= 1000:
        raise GeoError("Ukuran petak harus antara 10 dan 1000 meter.")
    crs = utm_crs_for(area_wgs84)
    fwd, inv = _transformers(crs)
    metric = transform(fwd, area_wgs84)
    s = float(cell_size_m)
    minx, miny, maxx, maxy = metric.bounds
    x0, y0 = math.floor(minx / s) * s, math.floor(miny / s) * s
    ncols, nrows = math.ceil((maxx - x0) / s), math.ceil((maxy - y0) / s)
    if ncols * nrows > max_cells * 40:
        raise GeoError("Area terlalu luas untuk dibagi menjadi petak dengan ukuran ini.")

    pm = prep(metric)
    full_area = s * s
    kept: list[tuple[int, int, object]] = []
    for r in range(nrows):  # r = 0 is the northernmost row
        y_top = y0 + (nrows - r) * s
        for c in range(ncols):
            x_left = x0 + c * s
            sq = box(x_left, y_top - s, x_left + s, y_top)
            if not pm.intersects(sq):
                continue
            inter = polygonal(sq.intersection(metric))
            if inter is None or inter.area < min_coverage * full_area:
                continue
            kept.append((r, c, inter.simplify(0.01)))  # drop sub-centimetre vertices left by clipping
            if len(kept) > max_cells:
                raise GeoError(f"Jumlah petak melebihi batas {max_cells}.")
    if not kept:
        return []
    r_min, c_min = min(k[0] for k in kept), min(k[1] for k in kept)  # ids start at R00C00
    return [
        Cell(cell_id=f"R{r - r_min:02d}C{c - c_min:02d}", row=r - r_min, col=c - c_min,
             geom=transform(inv, g), area_ha=g.area / 10_000.0, is_full=g.area >= full_area * 0.999)
        for r, c, g in kept
    ]


def round_geojson(geom, ndigits: int = 7) -> dict:
    def _r(obj):
        if isinstance(obj, (list, tuple)):
            return [_r(x) for x in obj]
        return round(obj, ndigits)

    m = mapping(geom)
    return {"type": m["type"], "coordinates": _r(m["coordinates"])}
