from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..security import current_user
from ..services import geo
from ..services.analysis import build_grid
from ..services.recommend import INTENSITIES
from .maps import get_map_or_404

router = APIRouter(prefix="/api/maps", tags=["grids"])


def summarize(props: dict[str, dict]) -> dict:
    by = {k: {"cells": 0, "area_ha": 0.0} for k in (*INTENSITIES, "none")}
    means = []
    for p in props.values():
        b = by[p["intensity"] or "none"]
        b["cells"] += 1
        b["area_ha"] = round(b["area_ha"] + p["area_ha"], 3)
        if p["ndvi_mean"] is not None:
            means.append(p["ndvi_mean"])
    return {
        "cells": len(props), "area_ha": round(sum(p["area_ha"] for p in props.values()), 2),
        "ndvi_mean": round(sum(means) / len(means), 3) if means else None, "by_intensity": by,
    }


@router.get("/{map_id}/grid")
def get_grid(map_id: int, version_id: int | None = None, cell_size: int | None = Query(None, ge=10, le=1000),
             _: User = Depends(current_user), db: Session = Depends(get_db)):
    m = get_map_or_404(db, map_id)
    try:
        cells, props, version, _rules = build_grid(db, m, version_id, cell_size)
    except geo.GeoError as exc:
        raise HTTPException(409, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "id": c.cell_id, "geometry": geo.round_geojson(c.geom), "properties": props[c.cell_id]}
            for c in cells
        ],
        "summary": summarize(props),
        "version": {"id": version.id, "label": version.label, "status": version.status} if version else None,
        "cell_size_m": cell_size or get_settings().grid_cell_size_m,
    }
