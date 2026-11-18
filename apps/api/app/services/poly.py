"""Mission Planner polygon export."""
from __future__ import annotations

from shapely.geometry import MultiPolygon, Polygon


def _ring(coords) -> str:
    return "\n".join(f"{y:.14f} {x:.14f}" for x, y in coords)


def build_poly(geom) -> str:
    polygons = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    return "\n".join(_ring(poly.exterior.coords) for poly in polygons) + "\n"
