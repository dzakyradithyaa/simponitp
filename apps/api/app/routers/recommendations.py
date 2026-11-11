from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import RecommendationRule, User
from ..schemas import Intensity, RuleUpdate
from ..security import current_user, log_activity, require_admin
from ..services import geo
from ..services.analysis import build_grid
from ..services.recommend import DISCLAIMER, INTENSITIES, load_rules, ranges_overlap
from .maps import get_map_or_404

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


def rule_out(r: RecommendationRule) -> dict:
    return {"intensity": r.intensity, "label": r.label, "color": r.color, "ndvi_min": r.ndvi_min,
            "ndvi_max": r.ndvi_max, "actions": r.actions, "notes": r.notes}


@router.get("/rules")
def get_rules(_: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"rules": [rule_out(r) for r in load_rules(db)], "disclaimer": DISCLAIMER}


@router.put("/rules/{intensity}")
def update_rule(intensity: Intensity, body: RuleUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rule = db.get(RecommendationRule, intensity)
    if rule is None:
        raise HTTPException(404, "Aturan tidak ditemukan.")
    lo = None if body.clear_min else (body.ndvi_min if body.ndvi_min is not None else rule.ndvi_min)
    hi = None if body.clear_max else (body.ndvi_max if body.ndvi_max is not None else rule.ndvi_max)
    if lo is not None and hi is not None and lo >= hi:
        raise HTTPException(422, "Batas bawah NDVI harus lebih kecil dari batas atas.")
    proposed = [{"ndvi_min": r.ndvi_min, "ndvi_max": r.ndvi_max} for r in load_rules(db) if r.intensity != intensity]
    proposed.append({"ndvi_min": lo, "ndvi_max": hi})
    if ranges_overlap(proposed):
        raise HTTPException(422, "Rentang NDVI tumpang tindih dengan kategori lain.")
    rule.ndvi_min, rule.ndvi_max = lo, hi
    if body.label is not None:
        rule.label = body.label
    if body.actions is not None:
        rule.actions = [a.model_dump() for a in body.actions]
    if body.notes is not None:
        rule.notes = body.notes
    rule.updated_at = datetime.now(timezone.utc)
    log_activity(db, admin, "update_rule", intensity)
    db.commit()
    return rule_out(rule)


@router.get("/analysis")
def analysis(map_id: int, intensity: Intensity, version_id: int | None = None,
             _: User = Depends(current_user), db: Session = Depends(get_db)):
    """Recommendation for one intensity: the rule plus the blocks that currently fall in it."""
    m = get_map_or_404(db, map_id)
    try:
        _cells, props, version, rules = build_grid(db, m, version_id)
    except geo.GeoError as exc:
        raise HTTPException(409, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    rule = next(r for r in rules if r.intensity == intensity)
    hits = [p for p in props.values() if p["intensity"] == intensity]
    return {
        "intensity": intensity, "rule": rule_out(rule), "version_id": version.id if version else None,
        "cell_ids": [p["cell_id"] for p in hits], "cells": len(hits),
        "area_ha": round(sum(p["area_ha"] for p in hits), 2), "disclaimer": DISCLAIMER,
        "has_ndvi": version is not None and version.status == "ready",
    }
