import re

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import CustomPolygon, User
from ..security import current_user, log_activity
from ..services import geo, kml
from ..services import poly
from ..services.analysis import build_grid
from .maps import get_map_or_404

router = APIRouter(prefix="/api/exports", tags=["exports"])
CELL_RE = re.compile(r"^R\d{2,}C\d{2,}$")
MEDIA = {"kml": "application/vnd.google-earth.kml+xml", "kmz": "application/vnd.google-earth.kmz", "poly": "text/plain",
         "zip": "application/zip"}
INTENSITY_LABEL = {"rendah": "Rendah", "sedang": "Sedang", "tinggi": "Tinggi"}


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "peta"


def _encode(fmt: str, doc_name: str, placemarks: list[dict], description: str | None = None) -> bytes:
    if fmt == "poly":
        return "\n".join(poly.build_poly(pm["geom"]).rstrip() for pm in placemarks).encode("utf-8") + b"\n"
    xml = kml.build_kml(doc_name, placemarks, description)
    return kml.to_kmz(xml) if fmt == "kmz" else xml.encode("utf-8")


def _download(content: bytes, ext: str, filename_base: str) -> Response:
    return Response(content, media_type=MEDIA[ext],
                    headers={"Content-Disposition": f'attachment; filename="{filename_base}.{ext}"'})


def _cell_placemark(cell: geo.Cell, p: dict, map_name: str) -> dict:
    ndvi = f", NDVI {p['ndvi_mean']:.2f}" if p["ndvi_mean"] is not None else ""
    label = INTENSITY_LABEL.get(p["intensity"] or "", "tanpa data NDVI")
    return {
        "name": cell.cell_id, "geom": cell.geom, "style": p["intensity"],
        "description": f"Petak {cell.cell_id} ({map_name}) - {p['area_ha']:.2f} ha{ndvi} - Intensitas: {label}",
        "data": {"cell_id": cell.cell_id, "area_ha": p["area_ha"], "ndvi_mean": p["ndvi_mean"] if p["ndvi_mean"] is not None else "",
                 "intensitas": p["intensity"] or ""},
    }


@router.get("/cells")
def export_cells(
    map_id: int, format: str = Query("kml", pattern="^(kml|kmz|poly)$"), version_id: int | None = None,
    cell_ids: str | None = None, separate: bool = False, cell_size: int | None = Query(None, ge=10, le=1000),
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    """Export blocks (default: all) as one KML/KMZ, or one file per block bundled in a ZIP."""
    m = get_map_or_404(db, map_id)
    try:
        cells, props, _version, _rules = build_grid(db, m, version_id, cell_size)
    except geo.GeoError as exc:
        raise HTTPException(409, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    if cell_ids:
        wanted = [c.strip() for c in cell_ids.split(",") if c.strip()]
        if any(not CELL_RE.match(c) for c in wanted):
            raise HTTPException(422, "Format ID petak tidak valid.")
        known = {c.cell_id for c in cells}
        missing = [c for c in wanted if c not in known]
        if missing:
            raise HTTPException(404, f"Petak tidak ditemukan: {', '.join(missing[:5])}")
        cells = [c for c in cells if c.cell_id in set(wanted)]
    if not cells:
        raise HTTPException(404, "Tidak ada petak untuk diekspor.")
    if format == "poly" and len(cells) > 1:
        separate = True

    base = slug(m.name)
    pms = [_cell_placemark(c, props[c.cell_id], m.name) for c in cells]
    log_activity(db, user, "export_cells", f"{m.name}: {len(cells)} petak, {format}{' (terpisah)' if separate else ''}")
    db.commit()
    if separate:
        files = {f"{base}_{pm['name']}.{format}": _encode(format, f"{m.name} {pm['name']}", [pm]) for pm in pms}
        return _download(kml.bundle(files), "zip", f"{base}_petak-{format}")
    suffix = cells[0].cell_id if len(cells) == 1 else (f"{len(cells)}-petak")
    return _download(_encode(format, f"{m.name} - petak 1 ha", pms), format, f"{base}_{suffix}")


@router.get("/polygons/{polygon_id}")
def export_polygon(
    polygon_id: int, format: str = Query("kml", pattern="^(kml|kmz|poly)$"), split: bool = False,
    cell_size: int | None = Query(None, ge=10, le=1000), user: User = Depends(current_user), db: Session = Depends(get_db),
):
    """Export a custom polygon, or (split=true) the 1-ha blocks inside it."""
    p = db.get(CustomPolygon, polygon_id)
    if not p or (user.role != "admin" and p.user_id != user.id):
        raise HTTPException(404, "Polygon tidak ditemukan.")
    geom = to_shape(p.geom)
    base = slug(p.name)
    if split:
        s = get_settings()
        try:
            cells = geo.generate_grid(geom, cell_size or s.grid_cell_size_m, s.grid_min_coverage, s.max_cells)
        except geo.GeoError as exc:
            raise HTTPException(409, str(exc)) from exc
        pms = [{"name": f"{p.name} {c.cell_id}", "geom": c.geom, "style": None,
                "description": f"{c.area_ha:.2f} ha", "data": {"cell_id": c.cell_id, "area_ha": round(c.area_ha, 3)}}
               for c in cells]
        name, fname = f"{p.name} - petak 1 ha", f"{base}_petak"
    else:
        pms = [{"name": p.name, "geom": geom, "style": None, "description": p.note or f"{p.area_ha:.2f} ha",
                "data": {"area_ha": round(p.area_ha, 3)}}]
        name, fname = p.name, base
    log_activity(db, user, "export_polygon", f"{p.name}: {format}{' (petak)' if split else ''}")
    db.commit()
    return _download(_encode(format, name, pms), format, fname)
