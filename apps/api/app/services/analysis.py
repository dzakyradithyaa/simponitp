"""Shared logic: grid + NDVI statistics + intensity for a map version."""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import MapArea, MapVersion
from . import geo, raster
from .recommend import classify, load_rules

_GRID_CACHE: dict[tuple, list[geo.Cell]] = {}


def boundary_shape(m: MapArea):
    from geoalchemy2.shape import to_shape

    if m.boundary is None:
        raise geo.GeoError("Peta ini belum memiliki TIFF. Unggah TIFF di Upload Peta terlebih dahulu.")
    return to_shape(m.boundary)


def grid_for(m: MapArea, size: int | None = None) -> list[geo.Cell]:
    s = get_settings()
    size = size or s.grid_cell_size_m
    key = (m.id, m.updated_at.isoformat(), size)
    if key not in _GRID_CACHE:
        if len(_GRID_CACHE) > 16:
            _GRID_CACHE.clear()
        _GRID_CACHE[key] = geo.generate_grid(boundary_shape(m), size, s.grid_min_coverage, s.max_cells)
    return _GRID_CACHE[key]


def resolve_version(db: Session, m: MapArea, version_id: int | None) -> MapVersion | None:
    if version_id is not None:
        v = db.get(MapVersion, version_id)
        if v is None or v.map_id != m.id:
            raise LookupError("Versi peta tidak ditemukan.")
        return v
    ready = [v for v in m.versions if v.status == "ready"]
    return next((v for v in ready if v.is_active), ready[-1] if ready else None)


def stats_for(db: Session, m: MapArea, v: MapVersion | None, cells: list[geo.Cell], size: int) -> dict:
    if v is None or v.status != "ready":
        return {}
    cache = v.cell_stats or {}
    if cache.get("size") == size and cache.get("boundary_ts") == m.updated_at.isoformat():
        return cache["cells"]
    computed = raster.cell_statistics(v.raster_path, cells)
    v.cell_stats = {"size": size, "boundary_ts": m.updated_at.isoformat(), "cells": computed}
    db.commit()
    return computed


def build_grid(db: Session, m: MapArea, version_id: int | None, size: int | None = None):
    """Return (cells, enriched properties per cell id, version, rules)."""
    size = size or get_settings().grid_cell_size_m
    cells = grid_for(m, size)
    version = resolve_version(db, m, version_id)
    rules = load_rules(db)
    stats = stats_for(db, m, version, cells, size)
    props: dict[str, dict] = {}
    for c in cells:
        st = stats.get(c.cell_id)
        mean = st["mean"] if st else None
        props[c.cell_id] = {
            "cell_id": c.cell_id, "row": c.row, "col": c.col, "area_ha": round(c.area_ha, 3), "is_full": c.is_full,
            "ndvi_mean": mean, "ndvi_min": st["min"] if st else None, "ndvi_max": st["max"] if st else None,
            "intensity": classify(mean, rules),
        }
    return cells, props, version, rules
