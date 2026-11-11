"""NDVI GeoTIFF processing: validation, footprint, colour ramp and per-block statistics."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.mask import raster_geometry_mask
from shapely.geometry import mapping
from shapely.ops import transform

MAX_PREVIEW_PX = 2048
MIN_VALID_COVERAGE = 0.5  # a block needs >= 50% valid NDVI pixels to get statistics

# NDVI colour ramp (value -> RGB)
_RAMP = [
    (-1.0, (120, 120, 140)), (0.0, (160, 120, 80)), (0.2, (214, 190, 90)),
    (0.4, (170, 205, 90)), (0.6, (80, 170, 80)), (0.8, (30, 115, 50)), (1.0, (10, 70, 30)),
]


class ProcessingError(ValueError):
    """User-facing raster problem (message is stored on the version and shown in the UI)."""


def is_tiff(head: bytes) -> bool:
    return head[:4] in (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+")


def colorize(arr: np.ndarray) -> np.ndarray:
    xs = [p[0] for p in _RAMP]
    rgba = np.zeros(arr.shape + (4,), dtype=np.uint8)
    valid = np.isfinite(arr)
    v = np.clip(np.where(valid, arr, 0), -1, 1)
    for ch in range(3):
        rgba[..., ch] = np.interp(v, xs, [p[1][ch] for p in _RAMP]).astype(np.uint8)
    rgba[..., 3] = np.where(valid, 210, 0)
    return rgba


def _open(path: str | Path):
    try:
        return rasterio.open(path)
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError("File tidak dapat dibaca sebagai GeoTIFF.") from exc


def _footprint(ds, sample: np.ma.MaskedArray):
    """Outline of the pixels that have NDVI, as a WGS84 MultiPolygon (holes filled, tiny specks dropped)."""
    from affine import Affine
    from rasterio.features import shapes
    from shapely.geometry import MultiPolygon, Polygon, shape
    from shapely.ops import transform as shp_transform, unary_union

    from .geo import clean_geometry, to_multipolygon

    valid = ~np.ma.getmaskarray(sample)
    sx, sy = ds.width / sample.shape[1], ds.height / sample.shape[0]
    tr = ds.transform * Affine.scale(sx, sy)
    parts = [shape(g) for g, v in shapes(valid.astype("uint8"), mask=valid, transform=tr) if v == 1]
    geom = unary_union(parts)
    px = max(abs(tr.a), abs(tr.e))
    geom = geom.buffer(2 * px).buffer(-2 * px)  # close hairline gaps
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    total = sum(p.area for p in polys)
    polys = [Polygon(p.exterior) for p in polys if p.area >= 0.001 * total]  # drop specks, fill holes
    geom = unary_union(polys).simplify(px)
    to_ll = Transformer.from_crs(ds.crs, 4326, always_xy=True).transform
    return to_multipolygon(clean_geometry(shp_transform(to_ll, geom)))


def process_ndvi(raster_path: str | Path) -> dict:
    """Validate an NDVI GeoTIFF and return its footprint, bounds (WGS84) and NDVI statistics."""
    with _open(raster_path) as ds:
        if ds.crs is None:
            raise ProcessingError("GeoTIFF tidak memiliki sistem koordinat (CRS).")
        scale = max(1, max(ds.width, ds.height) // MAX_PREVIEW_PX)
        sample = ds.read(1, masked=True, out_shape=(max(1, ds.height // scale), max(1, ds.width // scale)))
        sample = np.ma.masked_invalid(sample)
        vals = sample.compressed()
        if vals.size == 0:
            raise ProcessingError("GeoTIFF tidak berisi piksel bernilai.")
        lo, hi = float(np.percentile(vals, 0.5)), float(np.percentile(vals, 99.5))
        if lo < -1.05 or hi > 1.05:
            raise ProcessingError(
                f"Nilai band 1 ({lo:.2f} s/d {hi:.2f}) bukan NDVI. Gunakan GeoTIFF NDVI satu band dengan nilai -1 s/d 1."
            )
        stats = {"min": float(vals.min()), "max": float(vals.max()), "mean": float(vals.mean())}
        footprint = _footprint(ds, sample)
    return {"footprint": footprint, "bounds": list(footprint.bounds), "stats": stats}


def cell_statistics(raster_path: str | Path, cells) -> dict[str, dict | None]:
    """Mean/min/max NDVI per grid block (zonal statistics)."""
    out: dict[str, dict | None] = {}
    with _open(raster_path) as ds:
        to_raster = Transformer.from_crs(4326, ds.crs, always_xy=True).transform
        for c in cells:
            geom = transform(to_raster, c.geom)
            try:
                shape_mask, _, window = raster_geometry_mask(ds, [mapping(geom)], crop=True, all_touched=True)
                arr = np.ma.masked_invalid(ds.read(1, window=window, masked=True))
            except (ValueError, rasterio.errors.WindowError):  # block lies outside the raster
                out[c.cell_id] = None
                continue
            inside = ~shape_mask
            arr = np.ma.masked_where(np.ma.getmaskarray(arr) | (arr < -1.05) | (arr > 1.05), arr)
            valid = inside & ~np.ma.getmaskarray(arr)
            total = int(inside.sum())
            if total == 0 or valid.sum() / total < MIN_VALID_COVERAGE:
                out[c.cell_id] = None
                continue
            v = np.asarray(arr)[valid]
            out[c.cell_id] = {
                "mean": round(float(v.mean()), 4), "min": round(float(v.min()), 4),
                "max": round(float(v.max()), 4), "valid_pct": round(100 * float(valid.sum()) / total, 1),
            }
    return out
