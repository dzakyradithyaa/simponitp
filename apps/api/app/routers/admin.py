from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ActivityLog, CustomPolygon, User
from ..security import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview")
def overview(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Per-user usage: logins, uploads, polygons, exports."""
    counts: dict[int, dict[str, int]] = {}
    rows = (db.query(ActivityLog.user_id, ActivityLog.action, func.count())
            .filter(ActivityLog.user_id.isnot(None)).group_by(ActivityLog.user_id, ActivityLog.action).all())
    for uid, action, n in rows:
        counts.setdefault(uid, {})[action] = n
    polygons = dict(db.query(CustomPolygon.user_id, func.count()).group_by(CustomPolygon.user_id).all())
    out = []
    for u in db.query(User).order_by(User.created_at).all():
        c = counts.get(u.id, {})
        out.append({
            "id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role, "is_active": u.is_active,
            "last_login_at": u.last_login_at, "logins": c.get("login", 0), "uploads": c.get("upload_ndvi", 0),
            "polygons": polygons.get(u.id, 0), "exports": c.get("export_cells", 0) + c.get("export_polygon", 0),
        })
    return {"users": out}


@router.get("/activity")
def activity(user_id: int | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
             _: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(ActivityLog)
    if user_id is not None:
        q = q.filter(ActivityLog.user_id == user_id)
    total = q.count()
    rows = q.order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [{"id": r.id, "user_id": r.user_id, "username": r.username, "action": r.action,
                   "detail": r.detail, "created_at": r.created_at} for r in rows],
    }
