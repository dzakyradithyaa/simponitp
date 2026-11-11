import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from geoalchemy2.shape import from_shape
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import SessionLocal, get_db
from ..models import MapArea, MapVersion, User, utcnow
from ..schemas import MapCreate, MapUpdate, VersionUpdate
from ..security import current_user, log_activity, require_admin
from ..services import geo, raster, tiles
from ..services.analysis import boundary_shape

router = APIRouter(prefix="/api/maps", tags=["maps"])


def version_out(v: MapVersion) -> dict:
    return {
        "id": v.id, "map_id": v.map_id, "version": v.version, "label": v.label, "notes": v.notes,
        "status": v.status, "error": v.error, "original_filename": v.original_filename, "bounds": v.bounds,
        "stats": v.stats, "is_active": v.is_active, "created_at": v.created_at,
        "has_tiles": bool(v.tiles_path),
    }


def map_out(m: MapArea, with_boundary: bool = False) -> dict:
    out = {
        "id": m.id, "name": m.name, "description": m.description, "has_boundary": m.boundary is not None,
        "area_ha": None, "bounds": None, "created_at": m.created_at, "updated_at": m.updated_at,
        "versions": [version_out(v) for v in m.versions],
    }
    if m.boundary is not None:
        g = boundary_shape(m)
        out["area_ha"] = round(geo.area_ha(g), 2)
        out["bounds"] = list(g.bounds)
        if with_boundary:
            out["boundary"] = geo.round_geojson(g)
    return out


def get_map_or_404(db: Session, map_id: int) -> MapArea:
    m = db.get(MapArea, map_id)
    if not m:
        raise HTTPException(404, "Peta tidak ditemukan.")
    return m


async def save_upload(f: UploadFile, dest: Path, max_bytes: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    with dest.open("wb") as out:
        while chunk := await f.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"File melebihi batas {max_bytes // (1024 * 1024)} MB.")
            out.write(chunk)


def _name_taken(db: Session, name: str, exclude_id: int | None = None) -> bool:
    q = db.query(MapArea).filter(func.lower(MapArea.name) == name.strip().lower())
    if exclude_id:
        q = q.filter(MapArea.id != exclude_id)
    return q.first() is not None


@router.get("")
def list_maps(_: User = Depends(current_user), db: Session = Depends(get_db)):
    return [map_out(m) for m in db.query(MapArea).order_by(MapArea.created_at.desc()).all()]


@router.get("/{map_id}")
def get_map(map_id: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    return map_out(get_map_or_404(db, map_id), with_boundary=True)


@router.post("", status_code=201)
def create_map(body: MapCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Create an empty map. Its area (boundary) is taken from the first GeoTIFF uploaded to it."""
    if _name_taken(db, body.name):
        raise HTTPException(409, "Nama peta sudah dipakai.")
    m = MapArea(name=body.name.strip(), description=body.description or None, created_by=admin.id)
    db.add(m)
    log_activity(db, admin, "create_map", m.name)
    db.commit()
    return map_out(m)


@router.patch("/{map_id}")
def update_map(map_id: int, body: MapUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    m = get_map_or_404(db, map_id)
    if body.name is not None:
        if _name_taken(db, body.name, m.id):
            raise HTTPException(409, "Nama peta sudah dipakai.")
        m.name = body.name.strip()
    if body.description is not None:
        m.description = body.description or None
    log_activity(db, admin, "update_map", m.name)
    db.commit()
    return map_out(m)


@router.delete("/{map_id}", status_code=204)
def delete_map(map_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    m = get_map_or_404(db, map_id)
    log_activity(db, admin, "delete_map", m.name)
    db.delete(m)
    db.commit()
    shutil.rmtree(get_settings().storage_dir / "ndvi" / str(map_id), ignore_errors=True)


# ---------- versions (NDVI GeoTIFF uploads) ----------

def process_version(version_id: int) -> None:
    """Background job: validate the GeoTIFF, build the PMTiles archive, register the area on first upload."""
    db = SessionLocal()
    try:
        v = db.get(MapVersion, version_id)
        if v is None:
            return
        try:
            info = raster.process_ndvi(v.raster_path)
            tiles_path = Path(v.raster_path).with_suffix(".pmtiles")
            built = tiles.build_pmtiles(v.raster_path, tiles_path, name=v.label)
            v.tiles_path, v.bounds = str(tiles_path), info["bounds"]
            v.stats = {**info["stats"], "min_zoom": built["min_zoom"], "max_zoom": built["max_zoom"]}
            m = db.get(MapArea, v.map_id)
            if m.boundary is None:  # the first GeoTIFF defines the map area
                m.boundary = from_shape(info["footprint"], srid=4326)
                m.updated_at = utcnow()
            v.status, v.error = "ready", None
            for other in m.versions:
                other.is_active = other.id == v.id  # the newest ready version becomes active
        except raster.ProcessingError as exc:
            v.status, v.error = "failed", str(exc)
        except Exception:  # noqa: BLE001
            import logging
            logging.getLogger("simponi").exception("NDVI processing failed for version %s", version_id)
            v.status, v.error = "failed", "Gagal memproses file. Periksa format GeoTIFF."
        db.commit()
    finally:
        db.close()


@router.post("/{map_id}/versions", status_code=202)
async def upload_versions(
    map_id: int, background: BackgroundTasks, files: list[UploadFile] = File(...),
    label: str | None = Form(None), notes: str | None = Form(None),
    admin: User = Depends(require_admin), db: Session = Depends(get_db),
):
    m = get_map_or_404(db, map_id)
    settings = get_settings()
    next_no = (db.query(func.max(MapVersion.version)).filter(MapVersion.map_id == m.id).scalar() or 0) + 1
    created, rejected = [], []
    for f in files:
        name = f.filename or "upload.tif"
        if not name.lower().endswith((".tif", ".tiff")) or not raster.is_tiff(await f.read(8)):
            rejected.append({"filename": name, "error": "Bukan file GeoTIFF (.tif/.tiff)."})
            continue
        await f.seek(0)
        stem = re.sub(r"\.tiff?$", "", name, flags=re.I)[:120]
        path = settings.storage_dir / "ndvi" / str(m.id) / f"{uuid.uuid4().hex}.tif"
        try:
            await save_upload(f, path, settings.max_upload_mb * 1024 * 1024)
        except HTTPException as exc:
            rejected.append({"filename": name, "error": exc.detail})
            continue
        v_label = (f"{label.strip()} – {stem}" if label and len(files) > 1 else (label or stem)).strip()
        v = MapVersion(map_id=m.id, version=next_no, label=v_label[:160], notes=notes or None, status="processing",
                       original_filename=name[:255], raster_path=str(path), created_by=admin.id)
        db.add(v)
        created.append(v)
        next_no += 1
    db.flush()
    log_activity(db, admin, "upload_ndvi", f"{m.name}: {len(created)} file")
    db.commit()
    for v in created:
        background.add_task(process_version, v.id)
    return {"created": [version_out(v) for v in created], "rejected": rejected}


def _get_version(db: Session, map_id: int, version_id: int) -> MapVersion:
    v = db.get(MapVersion, version_id)
    if not v or v.map_id != map_id:
        raise HTTPException(404, "Versi peta tidak ditemukan.")
    return v


@router.get("/{map_id}/versions/{version_id}")
def get_version(map_id: int, version_id: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    return version_out(_get_version(db, map_id, version_id))


@router.patch("/{map_id}/versions/{version_id}")
def update_version(map_id: int, version_id: int, body: VersionUpdate, admin: User = Depends(require_admin),
                   db: Session = Depends(get_db)):
    v = _get_version(db, map_id, version_id)
    if body.label is not None:
        v.label = body.label.strip()
    if body.notes is not None:
        v.notes = body.notes or None
    if body.is_active is True:
        if v.status != "ready":
            raise HTTPException(409, "Hanya versi yang sudah selesai diproses yang dapat diaktifkan.")
        for other in v.map.versions:
            other.is_active = other.id == v.id
    elif body.is_active is False:
        v.is_active = False
    log_activity(db, admin, "update_version", f"{v.map.name} v{v.version}")
    db.commit()
    return version_out(v)


@router.delete("/{map_id}/versions/{version_id}", status_code=204)
def delete_version(map_id: int, version_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    v = _get_version(db, map_id, version_id)
    log_activity(db, admin, "delete_version", f"{v.map.name} v{v.version}")
    paths = [v.raster_path, v.tiles_path]
    db.delete(v)
    db.commit()
    for p in paths:
        if p:
            Path(p).unlink(missing_ok=True)


@router.get("/{map_id}/versions/{version_id}/tiles.pmtiles")
def version_tiles(map_id: int, version_id: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    """PMTiles archive for MapLibre. FileResponse answers HTTP Range requests, which PMTiles relies on."""
    v = _get_version(db, map_id, version_id)
    if not v.tiles_path or not Path(v.tiles_path).exists():
        raise HTTPException(404, "Tile peta belum tersedia.")
    return FileResponse(v.tiles_path, media_type="application/octet-stream", headers={"Cache-Control": "private, max-age=300"})
