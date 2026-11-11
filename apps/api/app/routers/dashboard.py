from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import CustomPolygon, MapArea, User
from ..security import current_user
from ..services import geo
from ..services.analysis import build_grid
from .grids import summarize
from .maps import map_out

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(map_id: int | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    maps = db.query(MapArea).order_by(MapArea.created_at.desc()).all()
    total_ha = 0.0
    for m in maps:
        if m.boundary is not None:
            total_ha += map_out(m)["area_ha"] or 0
    main = None
    if map_id is not None:
        main = next((m for m in maps if m.id == map_id), None)
        if main is None:
            raise HTTPException(404, "Peta tidak ditemukan.")
    else:
        main = next((m for m in maps if m.boundary is not None), None)

    featured = None
    if main is not None and main.boundary is not None:
        try:
            _cells, props, version, _rules = build_grid(db, main, None)
            featured = {
                "id": main.id, "name": main.name, "summary": summarize(props),
                "version": {"id": version.id, "label": version.label, "created_at": version.created_at} if version else None,
            }
        except geo.GeoError:
            featured = None

    polygons = db.query(CustomPolygon).filter(CustomPolygon.user_id == user.id).count()
    out = {
        "maps": len(maps), "total_area_ha": round(total_ha, 2), "my_polygons": polygons, "featured": featured,
        "versions": sum(len(m.versions) for m in maps),
    }
    if user.role == "admin":
        out["active_users"] = db.query(User).filter(User.is_active.is_(True)).count()
    return out
