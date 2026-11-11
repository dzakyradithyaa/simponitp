from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.shape import from_shape, to_shape
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import CustomPolygon, User
from ..schemas import PolygonCreate
from ..security import current_user, log_activity
from ..services import geo
from ..services.analysis import boundary_shape
from .maps import get_map_or_404

router = APIRouter(prefix="/api", tags=["polygons"])


def polygon_out(p: CustomPolygon, boundary=None) -> dict:
    g = to_shape(p.geom)
    coverage = None
    if boundary is not None and g.area > 0:
        coverage = round(100 * g.intersection(boundary).area / g.area, 1)
    return {
        "id": p.id, "map_id": p.map_id, "name": p.name, "note": p.note, "area_ha": round(p.area_ha, 3),
        "owner": p.owner.username if p.owner else None, "created_at": p.created_at, "coverage_pct": coverage,
        "geometry": geo.round_geojson(g),
    }


@router.get("/maps/{map_id}/polygons")
def list_polygons(map_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = get_map_or_404(db, map_id)
    q = db.query(CustomPolygon).filter(CustomPolygon.map_id == m.id)
    if user.role != "admin":  # users only see their own polygons
        q = q.filter(CustomPolygon.user_id == user.id)
    boundary = boundary_shape(m) if m.boundary is not None else None
    return [polygon_out(p, boundary) for p in q.order_by(CustomPolygon.created_at.desc()).all()]


@router.post("/maps/{map_id}/polygons", status_code=201)
def create_polygon(map_id: int, body: PolygonCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = get_map_or_404(db, map_id)
    try:
        poly = geo.polygon_from_geojson(body.geometry)
    except geo.GeoError as exc:
        raise HTTPException(422, str(exc)) from exc
    ha = geo.area_ha(poly)
    limit = get_settings().max_polygon_ha
    if ha < 0.01:
        raise HTTPException(422, "Area terlalu kecil (minimal 0,01 ha).")
    if ha > limit:
        raise HTTPException(422, f"Area terlalu luas (maksimal {limit:g} ha).")
    row = CustomPolygon(map_id=m.id, user_id=user.id, name=body.name.strip(), note=body.note or None,
                        geom=from_shape(poly, srid=4326), area_ha=ha)
    db.add(row)
    log_activity(db, user, "create_polygon", f"{m.name}: {row.name} ({ha:.2f} ha)")
    db.commit()
    return polygon_out(row, boundary_shape(m) if m.boundary is not None else None)


@router.delete("/polygons/{polygon_id}", status_code=204)
def delete_polygon(polygon_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(CustomPolygon, polygon_id)
    if not p or (user.role != "admin" and p.user_id != user.id):
        raise HTTPException(404, "Polygon tidak ditemukan.")
    log_activity(db, user, "delete_polygon", p.name)
    db.delete(p)
    db.commit()
