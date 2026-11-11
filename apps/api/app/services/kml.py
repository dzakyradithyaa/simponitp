"""KML / KMZ export (OGC KML 2.2) for drone mission-planning software."""
from __future__ import annotations

import io
import zipfile
from xml.sax.saxutils import escape

from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.polygon import orient

# KML colours are aabbggrr
STYLES = {
    "rendah": ("ff4a8c4c", "664a8c4c"),
    "sedang": ("ff25a5e0", "6625a5e0"),
    "tinggi": ("ff2b39c0", "662b39c0"),
    "none": ("ff3f9ec9", "663f9ec9"),
}


def _ring(coords) -> str:
    return " ".join(f"{x:.7f},{y:.7f},0" for x, y in coords)


def _polygon_xml(poly: Polygon) -> str:
    poly = orient(poly, 1.0)  # exterior counter-clockwise, holes clockwise
    out = ["<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>",
           _ring(poly.exterior.coords), "</coordinates></LinearRing></outerBoundaryIs>"]
    for hole in poly.interiors:
        out += ["<innerBoundaryIs><LinearRing><coordinates>", _ring(hole.coords), "</coordinates></LinearRing></innerBoundaryIs>"]
    out.append("</Polygon>")
    return "".join(out)


def _geometry_xml(geom) -> str:
    if isinstance(geom, MultiPolygon):
        return "<MultiGeometry>" + "".join(_polygon_xml(p) for p in geom.geoms) + "</MultiGeometry>"
    return _polygon_xml(geom)


def build_kml(doc_name: str, placemarks: list[dict], description: str | None = None) -> str:
    """placemarks: [{name, geom, description?, data?: dict, style?: 'rendah'|'sedang'|'tinggi'}]"""
    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
             f"<name>{escape(doc_name)}</name>"]
    if description:
        parts.append(f"<description>{escape(description)}</description>")
    for key, (line, fill) in STYLES.items():
        parts.append(
            f'<Style id="s-{key}"><LineStyle><color>{line}</color><width>2</width></LineStyle>'
            f"<PolyStyle><color>{fill}</color></PolyStyle></Style>"
        )
    for pm in placemarks:
        parts.append(f"<Placemark><name>{escape(pm['name'])}</name>")
        if pm.get("description"):
            parts.append(f"<description>{escape(pm['description'])}</description>")
        parts.append(f"<styleUrl>#s-{pm.get('style') or 'none'}</styleUrl>")
        if pm.get("data"):
            parts.append("<ExtendedData>")
            for k, v in pm["data"].items():
                parts.append(f'<Data name="{escape(str(k))}"><value>{escape(str(v))}</value></Data>')
            parts.append("</ExtendedData>")
        parts.append(_geometry_xml(pm["geom"]))
        parts.append("</Placemark>")
    parts.append("</Document></kml>")
    return "".join(parts)


def to_kmz(kml: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("doc.kml", kml.encode("utf-8"))
    return buf.getvalue()


def bundle(files: dict[str, bytes]) -> bytes:
    """ZIP several exported files (one per block) into one archive."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)
    return buf.getvalue()
