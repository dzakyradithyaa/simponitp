import io
import json
import zipfile
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree as ET

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from pyproj import Transformer
from rasterio.transform import from_origin
from shapely.geometry import box, mapping
from shapely.ops import transform

from app.db import SessionLocal
from app.main import app
from app.models import CustomPolygon, SessionRow, User

to_ll = Transformer.from_crs("EPSG:32749", 4326, always_xy=True).transform
X0, Y0, W, H = 430000, 9137000, 400, 300  # 400 x 300 m = 12 blocks of 1 ha


def make_tif(values="ndvi", nodata_patch=False) -> bytes:
    cols = np.linspace(0.10, 0.85, W, dtype="float32") if values == "ndvi" else np.linspace(0, 255, W, dtype="float32")
    data = np.tile(cols, (H, 1))
    if nodata_patch:
        data[:50, :50] = -9999
    buf = io.BytesIO()
    with rasterio.MemoryFile() as mem:
        with mem.open(driver="GTiff", width=W, height=H, count=1, dtype="float32", crs="EPSG:32749",
                      transform=from_origin(X0, Y0 + H, 1, 1), nodata=-9999) as ds:
            ds.write(data, 1)
        buf.write(mem.read())
    return buf.getvalue()


def poly_geojson(x, y, w, h) -> dict:
    return mapping(transform(to_ll, box(x, y, x + w, y + h)))


@pytest.fixture(scope="module")
def world(admin):
    r = admin.post("/api/maps", json={"name": "Kayangan Uji", "description": "peta uji"})
    assert r.status_code == 201, r.text
    m = r.json()
    assert not m["has_boundary"]  # no area until a GeoTIFF is uploaded
    r = admin.post(f"/api/maps/{m['id']}/versions", data={"label": "Survei Oktober"},
                   files=[("files", ("ndvi_okt.tif", make_tif(), "image/tiff"))])
    assert r.status_code == 202, r.text
    return {"map": m["id"], "version": r.json()["created"][0]["id"]}


# ---------------- auth ----------------

def test_login_errors_and_throttle(admin):
    with TestClient(app) as c:
        assert c.post("/api/auth/login", json={"username": "admin", "password": "salah"}).status_code == 401
        codes = [c.post("/api/auth/login", json={"username": "ghost", "password": "x"}).status_code for _ in range(7)]
        assert codes[:5] == [401] * 5 and codes[5:] == [429, 429]


def test_remember_me_and_idle_timeout(admin):
    with TestClient(app) as c:
        r = c.post("/api/auth/login", json={"username": "admin", "password": "Admin12345"})
        assert r.json()["idle_timeout_seconds"] == 3600 and "max-age" not in r.headers["set-cookie"].lower()
        assert "httponly" in r.headers["set-cookie"].lower() and "samesite=lax" in r.headers["set-cookie"].lower()
        r = c.post("/api/auth/login", json={"username": "admin", "password": "Admin12345", "remember": True})
        assert r.json()["idle_timeout_seconds"] == 7 * 86400 and "max-age" in r.headers["set-cookie"].lower()


def test_session_expires_after_idle_timeout(admin, user):
    with TestClient(app) as c:
        assert c.post("/api/auth/login", json={"username": "petugas1", "password": "Petugas123"}).status_code == 200
        assert c.get("/api/auth/me").status_code == 200
        with SessionLocal() as db:
            row = db.query(SessionRow).order_by(SessionRow.created_at.desc()).first()
            row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)  # 1 h of inactivity elapsed
            db.commit()
        assert c.get("/api/auth/me").status_code == 401
        assert c.get("/api/maps").status_code == 401


def test_roles_and_csrf(admin, user):
    assert user.get("/api/users").status_code == 403
    assert user.get("/api/admin/overview").status_code == 403
    assert user.post("/api/maps", data={"name": "Nakal"}).status_code == 403
    assert admin.get("/api/users").status_code == 200
    r = admin.post("/api/users", json={"username": "x1", "full_name": "X", "password": "Password1"},
                   headers={"Origin": "http://evil.example"})
    assert r.status_code == 403


def test_user_management_guards(admin):
    me = next(u for u in admin.get("/api/users").json() if u["username"] == "admin")
    assert admin.patch(f"/api/users/{me['id']}", json={"role": "user"}).status_code == 409
    assert admin.delete(f"/api/users/{me['id']}").status_code == 409
    assert admin.post("/api/users", json={"username": "Bad Name", "full_name": "x", "password": "Password1"}).status_code == 422
    assert admin.post("/api/users", json={"username": "petugas1", "full_name": "x", "password": "Password1"}).status_code == 409
    assert admin.post("/api/users", json={"username": "okeoke", "full_name": "x", "password": "pendek"}).status_code == 422


# ---------------- maps, NDVI, grid ----------------

def test_ndvi_upload_builds_pmtiles_and_defines_area(admin, world):
    m = admin.get(f"/api/maps/{world['map']}").json()
    assert m["has_boundary"] and m["area_ha"] == pytest.approx(12.0, rel=0.01)  # area = GeoTIFF footprint
    v = m["versions"][0]
    assert v["status"] == "ready" and v["is_active"] and v["label"] == "Survei Oktober" and v["has_tiles"]
    assert 0.1 < v["stats"]["mean"] < 0.85 and len(v["bounds"]) == 4

    url = f"/api/maps/{m['id']}/versions/{v['id']}/tiles.pmtiles"
    full = admin.get(url)
    assert full.status_code == 200 and full.content[:7] == b"PMTiles"
    part = admin.get(url, headers={"Range": "bytes=0-126"})  # PMTiles clients read with HTTP Range
    assert part.status_code == 206 and len(part.content) == 127 and part.content == full.content[:127]

    from pmtiles.reader import MemorySource, Reader
    from pmtiles.tile import zxy_to_tileid  # noqa: F401
    import mercantile
    reader = Reader(MemorySource(full.content))
    hdr = reader.header()
    assert hdr["min_zoom"] < hdr["max_zoom"] <= 20
    cx, cy = (v["bounds"][0] + v["bounds"][2]) / 2, (v["bounds"][1] + v["bounds"][3]) / 2
    tile = mercantile.tile(cx, cy, hdr["max_zoom"])
    png = reader.get(tile.z, tile.x, tile.y)
    assert png is not None and png[:4] == b"\x89PNG"


def test_area_follows_valid_data_footprint(admin):
    m = admin.post("/api/maps", json={"name": "Footprint Uji"}).json()
    admin.post(f"/api/maps/{m['id']}/versions", files=[("files", ("n.tif", make_tif(nodata_patch=True), "image/tiff"))])
    got = admin.get(f"/api/maps/{m['id']}").json()
    assert got["area_ha"] == pytest.approx(11.75, rel=0.01)  # the 50 x 50 m no-data corner is excluded
    assert admin.delete(f"/api/maps/{m['id']}").status_code == 204


def test_tiles_require_login(world):
    with TestClient(app) as anon:
        assert anon.get(f"/api/maps/{world['map']}/versions/{world['version']}/tiles.pmtiles").status_code == 401


def test_grid_has_one_hectare_blocks_and_intensity(user, world):
    g = user.get(f"/api/maps/{world['map']}/grid").json()
    assert len(g["features"]) == 12 and g["summary"]["area_ha"] == pytest.approx(12.0, rel=0.01)
    by_col: dict[int, set] = {}
    for f in g["features"]:
        p = f["properties"]
        assert p["area_ha"] == pytest.approx(1.0, abs=0.01) and p["is_full"]
        by_col.setdefault(p["col"], set()).add(p["intensity"])
    assert by_col == {0: {"tinggi"}, 1: {"sedang"}, 2: {"sedang"}, 3: {"rendah"}}  # NDVI rises west -> east
    assert g["summary"]["by_intensity"]["none"]["cells"] == 0
    assert g["version"]["label"] == "Survei Oktober"


def test_grid_cell_size_param_and_unknown_version(user, world):
    g = user.get(f"/api/maps/{world['map']}/grid", params={"cell_size": 50}).json()
    assert len(g["features"]) == 48
    assert user.get(f"/api/maps/{world['map']}/grid", params={"version_id": 99999}).status_code == 404


def test_rejects_bad_uploads_and_non_ndvi_rasters(admin, world):
    r = admin.post(f"/api/maps/{world['map']}/versions", files=[
        ("files", ("fake.tif", b"bukan tiff sama sekali", "image/tiff")),
        ("files", ("foto.png", b"\x89PNG....", "image/png"))])
    assert r.status_code == 202 and r.json()["created"] == [] and len(r.json()["rejected"]) == 2
    r = admin.post(f"/api/maps/{world['map']}/versions", files=[("files", ("rgb.tif", make_tif("rgb"), "image/tiff"))])
    v = admin.get(f"/api/maps/{world['map']}/versions/{r.json()['created'][0]['id']}").json()
    assert v["status"] == "failed" and "bukan NDVI" in v["error"] and not v["is_active"]
    assert admin.patch(f"/api/maps/{world['map']}/versions/{v['id']}", json={"is_active": True}).status_code == 409
    assert admin.delete(f"/api/maps/{world['map']}/versions/{v['id']}").status_code == 204


def test_versions_batch_activate_and_switch(admin, world):
    r = admin.post(f"/api/maps/{world['map']}/versions", data={"label": "Batch"},
                   files=[("files", ("a.tif", make_tif(), "image/tiff")), ("files", ("b.tiff", make_tif(), "image/tiff"))])
    created = r.json()["created"]
    assert [c["label"] for c in created] == ["Batch – a", "Batch – b"]
    m = admin.get(f"/api/maps/{world['map']}").json()
    assert [v["is_active"] for v in m["versions"] if v["status"] == "ready"] == [False, False, True]
    first = m["versions"][0]["id"]
    assert admin.patch(f"/api/maps/{world['map']}/versions/{first}", json={"is_active": True}).json()["is_active"]
    assert admin.get(f"/api/maps/{world['map']}/grid").json()["version"]["id"] == first
    for c in created:
        assert admin.delete(f"/api/maps/{world['map']}/versions/{c['id']}").status_code == 204


def test_empty_map_has_no_grid_until_a_tiff_is_uploaded(admin):
    m = admin.post("/api/maps", json={"name": "Tanpa Batas"}).json()
    assert not m["has_boundary"]
    assert admin.get(f"/api/maps/{m['id']}/grid").status_code == 409
    admin.post(f"/api/maps/{m['id']}/versions", files=[("files", ("x.tif", make_tif(), "image/tiff"))])
    assert admin.get(f"/api/maps/{m['id']}/grid").status_code == 200
    assert admin.delete(f"/api/maps/{m['id']}").status_code == 204
    assert admin.get(f"/api/maps/{m['id']}").status_code == 404


def test_map_name_must_be_unique_and_valid(admin, world):
    assert admin.post("/api/maps", json={"name": "kayangan uji"}).status_code == 409
    assert admin.post("/api/maps", json={"name": "x"}).status_code == 422
    # boundary files are no longer accepted: the area always comes from the GeoTIFF
    assert admin.put(f"/api/maps/{world['map']}/boundary", files={"boundary": ("b.kml", b"<kml/>")}).status_code in (404, 405)


# ---------------- recommendations ----------------

def test_rules_and_analysis(user, admin, world):
    rules = user.get("/api/recommendations/rules").json()
    assert [r["intensity"] for r in rules["rules"]] == ["rendah", "sedang", "tinggi"] and "draf" in rules["disclaimer"]
    a = user.get("/api/recommendations/analysis", params={"map_id": world["map"], "intensity": "sedang"}).json()
    assert a["cells"] == 6 and a["area_ha"] == pytest.approx(6.0, abs=0.1) and a["has_ndvi"]
    assert {x["interval_label"] for x in a["rule"]["actions"]} == {"Mingguan"}
    assert user.put("/api/recommendations/rules/sedang", json={"notes": "x"}).status_code == 403


def test_rule_update_validation_and_effect(admin, user, world):
    assert admin.put("/api/recommendations/rules/sedang", json={"ndvi_min": 0.1}).status_code == 422  # overlaps tinggi
    assert admin.put("/api/recommendations/rules/tinggi", json={"ndvi_max": 0.7}).status_code == 422  # overlaps others
    r = admin.put("/api/recommendations/rules/tinggi", json={"ndvi_max": 0.3})
    r2 = admin.put("/api/recommendations/rules/sedang", json={"ndvi_min": 0.3})
    assert r.status_code == 200 and r2.status_code == 200
    # 0.35 threshold moved to 0.30: column 0 (mean ~0.19) remains high intensity
    a = user.get("/api/recommendations/analysis", params={"map_id": world["map"], "intensity": "tinggi"}).json()
    assert a["cells"] == 3
    admin.put("/api/recommendations/rules/sedang", json={"ndvi_min": 0.35})
    admin.put("/api/recommendations/rules/tinggi", json={"ndvi_max": 0.35})


# ---------------- exports & polygons ----------------

NS = {"k": "http://www.opengis.net/kml/2.2"}


def test_export_single_cell_kml_and_kmz(user, world):
    r = user.get("/api/exports/cells", params={"map_id": world["map"], "cell_ids": "R00C00", "format": "kml"})
    assert r.status_code == 200 and "R00C00" in r.headers["content-disposition"]
    root = ET.fromstring(r.content)
    assert len(root.findall(".//k:Placemark", NS)) == 1
    assert "Intensitas: Tinggi" in root.find(".//k:Placemark/k:description", NS).text
    r = user.get("/api/exports/cells", params={"map_id": world["map"], "cell_ids": "R00C00,R01C03", "format": "kmz"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert len(ET.fromstring(z.read("doc.kml")).findall(".//k:Placemark", NS)) == 2
    poly = user.get("/api/exports/cells", params={"map_id": world["map"], "cell_ids": "R00C00", "format": "poly"})
    assert poly.status_code == 200 and poly.headers["content-disposition"].endswith(".poly\"")
    points = [line.split() for line in poly.text.strip().splitlines()]
    assert len(points) == 5 and points[0] == points[-1] and len(points[0]) == 2
    poly_zip = user.get("/api/exports/cells", params={"map_id": world["map"], "cell_ids": "R00C00,R01C03", "format": "poly"})
    z = zipfile.ZipFile(io.BytesIO(poly_zip.content))
    assert len(z.namelist()) == 2 and all(n.endswith(".poly") for n in z.namelist())


def test_export_all_and_separate_files(user, world):
    r = user.get("/api/exports/cells", params={"map_id": world["map"]})
    assert len(ET.fromstring(r.content).findall(".//k:Placemark", NS)) == 12
    r = user.get("/api/exports/cells", params={"map_id": world["map"], "separate": True, "format": "kml"})
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert len(z.namelist()) == 12 and all(n.endswith(".kml") for n in z.namelist())


def test_export_validation(user, world):
    base = {"map_id": world["map"]}
    assert user.get("/api/exports/cells", params={**base, "cell_ids": "R99C99"}).status_code == 404
    assert user.get("/api/exports/cells", params={**base, "cell_ids": "../etc"}).status_code == 422
    assert user.get("/api/exports/cells", params={**base, "format": "shp"}).status_code == 422


def test_custom_polygon_flow(user, admin, world):
    geo = poly_geojson(X0 + 50, Y0 + 50, 150, 100)  # 1.5 ha, inside the boundary
    r = user.post(f"/api/maps/{world['map']}/polygons", json={"name": "Target semprot A", "geometry": geo})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["area_ha"] == pytest.approx(1.5, rel=0.01) and p["coverage_pct"] == pytest.approx(100, abs=0.5)
    assert [x["id"] for x in user.get(f"/api/maps/{world['map']}/polygons").json()] == [p["id"]]

    kml = user.get(f"/api/exports/polygons/{p['id']}")
    root = ET.fromstring(kml.content)
    assert root.find(".//k:Placemark/k:name", NS).text == "Target semprot A"
    split = user.get(f"/api/exports/polygons/{p['id']}", params={"split": True, "format": "kmz"})
    z = zipfile.ZipFile(io.BytesIO(split.content))
    names = [e.text for e in ET.fromstring(z.read("doc.kml")).findall(".//k:Placemark/k:name", NS)]
    assert 2 <= len(names) <= 6

    # admin sees every polygon; a user only sees their own
    r2 = admin.post(f"/api/maps/{world['map']}/polygons", json={"name": "Milik admin", "geometry": poly_geojson(X0, Y0, 100, 100)})
    assert len(admin.get(f"/api/maps/{world['map']}/polygons").json()) == 2
    assert len(user.get(f"/api/maps/{world['map']}/polygons").json()) == 1
    assert user.get(f"/api/exports/polygons/{r2.json()['id']}").status_code == 404
    assert user.delete(f"/api/polygons/{r2.json()['id']}").status_code == 404
    assert user.delete(f"/api/polygons/{p['id']}").status_code == 204


def test_polygon_validation(user, world):
    url = f"/api/maps/{world['map']}/polygons"
    assert user.post(url, json={"name": "p", "geometry": {"type": "Point", "coordinates": [110, -7]}}).status_code == 422
    assert user.post(url, json={"name": "kecil", "geometry": poly_geojson(X0, Y0, 5, 5)}).status_code == 422
    assert user.post(url, json={"name": "raksasa", "geometry": poly_geojson(X0, Y0, 30000, 30000)}).status_code == 422
    outside = user.post(url, json={"name": "luar", "geometry": poly_geojson(X0 + 300, Y0 + 100, 200, 100)})
    assert outside.status_code == 201 and outside.json()["coverage_pct"] == pytest.approx(50, abs=1)


# ---------------- dashboard, admin ----------------

def test_dashboard_and_admin_panel(user, admin, world):
    d = user.get("/api/dashboard/summary").json()
    assert d["maps"] >= 1 and d["featured"]["summary"]["cells"] == 12 and "active_users" not in d
    assert admin.get("/api/dashboard/summary").json()["active_users"] >= 2
    ov = {u["username"]: u for u in admin.get("/api/admin/overview").json()["users"]}
    assert ov["admin"]["uploads"] >= 1 and ov["petugas1"]["exports"] >= 3 and ov["petugas1"]["polygons"] >= 1
    uid = ov["petugas1"]["id"]
    act = admin.get("/api/admin/activity", params={"user_id": uid}).json()
    assert act["total"] > 0 and all(i["username"] == "petugas1" for i in act["items"])


def test_deactivating_a_user_ends_their_sessions(admin):
    admin.post("/api/users", json={"username": "sementara", "full_name": "Sementara", "password": "Sementara1"})
    with TestClient(app) as c:
        assert c.post("/api/auth/login", json={"username": "sementara", "password": "Sementara1"}).status_code == 200
        uid = next(u["id"] for u in admin.get("/api/users").json() if u["username"] == "sementara")
        assert admin.patch(f"/api/users/{uid}", json={"is_active": False}).status_code == 200
        assert c.get("/api/auth/me").status_code == 401
        assert c.post("/api/auth/login", json={"username": "sementara", "password": "Sementara1"}).status_code == 401
    assert admin.delete(f"/api/users/{uid}").status_code == 204


def test_delete_map_cascades(admin):
    m = admin.post("/api/maps", json={"name": "Hapus Saya"}).json()
    admin.post(f"/api/maps/{m['id']}/versions", files=[("files", ("x.tif", make_tif(), "image/tiff"))])
    admin.post(f"/api/maps/{m['id']}/polygons", json={"name": "z", "geometry": poly_geojson(X0, Y0, 100, 100)})
    assert admin.delete(f"/api/maps/{m['id']}").status_code == 204
    with SessionLocal() as db:
        assert db.query(CustomPolygon).filter(CustomPolygon.map_id == m["id"]).count() == 0
