"""Turn an NDVI GeoTIFF into a PMTiles raster archive (PNG tiles, Web Mercator) for MapLibre."""
from __future__ import annotations

import io
import math
from pathlib import Path

import mercantile
import numpy as np
import rasterio
from PIL import Image
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import write
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds

from .raster import ProcessingError, colorize

TILE_SIZE = 256
MIN_ZOOM_FLOOR = 8
MAX_ZOOM_CAP = 20
MAX_TILES = 30_000
ZOOM_SPAN = 5  # number of zoom levels below the native one that are also generated


def _pixel_size_m(ds) -> float:
    xres = abs(ds.res[0])
    if ds.crs.is_geographic:
        lat = (ds.bounds.top + ds.bounds.bottom) / 2
        return xres * 111_320 * max(math.cos(math.radians(lat)), 0.1)
    try:
        return xres * ds.crs.linear_units_factor[1]
    except Exception:  # noqa: BLE001
        return xres


def build_pmtiles(raster_path: str | Path, out_path: str | Path, name: str = "NDVI") -> dict:
    """Write `out_path` and return {"min_zoom", "max_zoom", "tiles"}."""
    with rasterio.open(raster_path) as ds:
        w, s, e, n = transform_bounds(ds.crs, "EPSG:4326", *ds.bounds)
        lat_mid = (s + n) / 2
        native = math.log2(156_543.03392 * max(math.cos(math.radians(lat_mid)), 0.1) / _pixel_size_m(ds))
        max_z = int(min(max(round(native), MIN_ZOOM_FLOOR + 1), MAX_ZOOM_CAP))
        while True:  # keep the archive small for very large rasters
            min_z = max(max_z - ZOOM_SPAN, MIN_ZOOM_FLOOR)
            tiles = list(mercantile.tiles(w, s, e, n, zooms=list(range(min_z, max_z + 1))))
            if len(tiles) <= MAX_TILES or max_z <= MIN_ZOOM_FLOOR + 1:
                break
            max_z -= 1
        if len(tiles) > MAX_TILES * 2:
            raise ProcessingError("Area GeoTIFF terlalu luas untuk dibuat menjadi tile.")

        src_nodata = ds.nodata if ds.nodata is not None else np.nan
        encoded: dict[int, bytes] = {}
        for t in tiles:
            west, south, east, north = mercantile.xy_bounds(t)
            dest = np.full((TILE_SIZE, TILE_SIZE), np.nan, dtype="float32")
            reproject(
                source=rasterio.band(ds, 1), destination=dest, src_crs=ds.crs, src_nodata=src_nodata,
                dst_crs="EPSG:3857", dst_transform=from_bounds(west, south, east, north, TILE_SIZE, TILE_SIZE),
                dst_nodata=np.nan, resampling=Resampling.bilinear if t.z == max_z else Resampling.average,
            )
            dest[(dest < -1.05) | (dest > 1.05)] = np.nan
            if not np.isfinite(dest).any():
                continue  # fully empty tile
            buf = io.BytesIO()
            Image.fromarray(colorize(dest), "RGBA").save(buf, format="PNG")
            encoded[zxy_to_tileid(t.z, t.x, t.y)] = buf.getvalue()

    if not encoded:
        raise ProcessingError("Tidak ada piksel NDVI yang bisa dibuat menjadi tile.")
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    e7 = lambda v: int(round(v * 1e7))  # noqa: E731
    with write(str(out_path)) as writer:
        for tid in sorted(encoded):
            writer.write_tile(tid, encoded[tid])
        writer.finalize(
            {
                "tile_type": TileType.PNG, "tile_compression": Compression.NONE,
                "min_zoom": min_z, "max_zoom": max_z,
                "min_lon_e7": e7(w), "min_lat_e7": e7(s), "max_lon_e7": e7(e), "max_lat_e7": e7(n),
                "center_zoom": (min_z + max_z) // 2, "center_lon_e7": e7((w + e) / 2), "center_lat_e7": e7((s + n) / 2),
            },
            {"name": name, "type": "overlay", "format": "png", "attribution": "SIMPONI TP"},
        )
    return {"min_zoom": min_z, "max_zoom": max_z, "tiles": len(encoded)}
