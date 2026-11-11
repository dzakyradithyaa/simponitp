import io
import zipfile
from types import SimpleNamespace
from xml.etree import ElementTree as ET

import pytest
from pyproj import Transformer
from shapely.geometry import Polygon, box
from shapely.ops import transform

from app.services import geo, kml
from app.services.recommend import classify, ranges_overlap, DEFAULT_RULES

UTM = "EPSG:32749"  # UTM 49S, around Yogyakarta
to_ll = Transformer.from_crs(UTM, 4326, always_xy=True).transform


def utm_box(x, y, w, h):
    return transform(to_ll, box(x, y, x + w, y + h))


def test_grid_full_blocks_are_one_hectare():
    cells = geo.generate_grid(utm_box(430000, 9137000, 300, 200))
    assert len(cells) == 6
    assert {c.cell_id for c in cells} == {f"R{r:02d}C{c:02d}" for r in range(2) for c in range(3)}
    assert all(c.is_full and c.area_ha == pytest.approx(1.0, abs=1e-6) for c in cells)
    assert cells[0].cell_id == "R00C00"  # north-west corner first


def test_grid_clips_edge_blocks_and_conserves_area():
    area = utm_box(430000, 9137000, 150, 100)
    cells = geo.generate_grid(area)
    assert sorted(round(c.area_ha, 2) for c in cells) == [0.5, 1.0]
    assert sum(c.area_ha for c in cells) == pytest.approx(geo.area_ha(area), rel=1e-6)


def test_grid_cell_size_is_adjustable():
    cells = geo.generate_grid(utm_box(430000, 9137000, 200, 200), cell_size_m=50)
    assert len(cells) == 16 and all(c.area_ha == pytest.approx(0.25, abs=1e-6) for c in cells)
    with pytest.raises(geo.GeoError):
        geo.generate_grid(utm_box(430000, 9137000, 200, 200), cell_size_m=5)


def test_polygon_validation():
    bowtie = {"type": "Polygon", "coordinates": [[[110, -7], [110.001, -7.001], [110.001, -7], [110, -7.001], [110, -7]]]}
    assert geo.polygon_from_geojson(bowtie).is_valid  # repaired
    with pytest.raises(geo.GeoError):
        geo.polygon_from_geojson({"type": "Point", "coordinates": [110, -7]})
    with pytest.raises(geo.GeoError):
        geo.polygon_from_geojson({"type": "Polygon", "coordinates": [[[200, 0], [201, 0], [201, 1], [200, 0]]]})


def test_kml_and_kmz_structure():
    cells = geo.generate_grid(utm_box(430000, 9137000, 200, 100))
    pms = [{"name": c.cell_id, "geom": c.geom, "style": "sedang", "data": {"area_ha": 1}} for c in cells]
    xml = kml.build_kml("Uji & <Peta>", pms)
    root = ET.fromstring(xml)
    ns = {"k": "http://www.opengis.net/kml/2.2"}
    assert len(root.findall(".//k:Placemark", ns)) == 2
    ring = root.find(".//k:coordinates", ns).text.split()
    assert len(ring) == 5 and ring[0] == ring[-1]
    assert root.find(".//k:Document/k:name", ns).text == "Uji & <Peta>"
    z = zipfile.ZipFile(io.BytesIO(kml.to_kmz(xml)))
    assert z.namelist() == ["doc.kml"] and ET.fromstring(z.read("doc.kml")) is not None


def test_kml_polygon_is_counter_clockwise():
    cw = Polygon([(110, -7), (110, -7.001), (110.001, -7.001), (110.001, -7)])
    ring = ET.fromstring(kml.build_kml("x", [{"name": "p", "geom": cw}])).find(".//{*}coordinates").text.split()
    pts = [tuple(map(float, p.split(",")[:2])) for p in ring]
    assert Polygon(pts).exterior.is_ccw


def test_intensity_classification_defaults():
    rules = [SimpleNamespace(intensity=r["intensity"], ndvi_min=r["ndvi_min"], ndvi_max=r["ndvi_max"]) for r in DEFAULT_RULES]
    got = {v: classify(v, rules) for v in (-0.2, 0.2, 0.349, 0.35, 0.5, 0.6, 0.9)}
    assert got == {-0.2: "tinggi", 0.2: "tinggi", 0.349: "tinggi", 0.35: "sedang", 0.5: "sedang", 0.6: "rendah", 0.9: "rendah"}
    assert classify(None, rules) is None
    assert not ranges_overlap([{"ndvi_min": r["ndvi_min"], "ndvi_max": r["ndvi_max"]} for r in DEFAULT_RULES])
    assert ranges_overlap([{"ndvi_min": None, "ndvi_max": 0.5}, {"ndvi_min": 0.4, "ndvi_max": None}])
