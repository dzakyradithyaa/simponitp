"""Intensity classes and default recommendation rules.

IMPORTANT: the thresholds and actions below are a DRAFT so the system works out of the box.
Category definitions, parameters and rules still have to be confirmed with people who have
agronomy expertise (see docs/recommendation-rules.md). Admins can change them via the API.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import RecommendationRule

INTENSITIES = ("rendah", "sedang", "tinggi")

DISCLAIMER = (
    "Aturan bawaan ini bersifat draf dan belum divalidasi. Dosis, jenis bahan, dan interval "
    "harus ditetapkan bersama pihak yang kompeten di bidang pertanian."
)

DEFAULT_RULES = [
    {
        "intensity": "rendah", "label": "Rendah", "color": "#4C8C4A", "ndvi_min": 0.6, "ndvi_max": None,
        "notes": "Vegetasi relatif sehat. Cukup dipantau dan dirawat rutin.",
        "actions": [
            {"type": "pemantauan", "title": "Pemantauan rutin", "level": "rendah", "interval_days": 14,
             "interval_label": "Setiap 2 minggu", "detail": "Pantau NDVI dan kondisi visual petak secara berkala."},
            {"type": "pemupukan", "title": "Pemupukan pemeliharaan", "level": "rendah", "interval_days": 14,
             "interval_label": "Setiap 2 minggu", "detail": "Pupuk pemeliharaan dosis rendah; dosis ditentukan agronom."},
        ],
    },
    {
        "intensity": "sedang", "label": "Sedang", "color": "#E0A526", "ndvi_min": 0.35, "ndvi_max": 0.6,
        "notes": "Vegetasi menunjukkan tanda tekanan ringan hingga sedang.",
        "actions": [
            {"type": "pemupukan", "title": "Pemupukan korektif", "level": "sedang", "interval_days": 7,
             "interval_label": "Mingguan", "detail": "Pupuk dosis sedang; jenis dan dosis ditentukan agronom."},
            {"type": "penyemprotan", "title": "Penyemprotan", "level": "sedang", "interval_days": 7,
             "interval_label": "Mingguan", "detail": "Penyemprotan intensitas sedang sesuai hasil pengecekan lapangan."},
        ],
    },
    {
        "intensity": "tinggi", "label": "Tinggi", "color": "#C0392B", "ndvi_min": None, "ndvi_max": 0.35,
        "notes": "Vegetasi tertekan berat atau jarang. Perlu penanganan intensif dan verifikasi lapangan.",
        "actions": [
            {"type": "inspeksi", "title": "Inspeksi lapangan", "level": "tinggi", "interval_days": 1,
             "interval_label": "Harian", "detail": "Pastikan penyebab (hama, kekurangan hara, air) sebelum tindakan lanjutan."},
            {"type": "penyemprotan", "title": "Penyemprotan intensif", "level": "tinggi", "interval_days": 1,
             "interval_label": "Harian", "detail": "Penyemprotan intensitas tinggi; frekuensi mengikuti arahan agronom."},
            {"type": "pemupukan", "title": "Pemupukan intensif", "level": "tinggi", "interval_days": 7,
             "interval_label": "Mingguan", "detail": "Pupuk dosis tinggi; jenis dan dosis ditentukan agronom."},
        ],
    },
]


def seed_rules(db: Session) -> None:
    existing = {r.intensity for r in db.query(RecommendationRule.intensity).all()}
    for r in DEFAULT_RULES:
        if r["intensity"] not in existing:
            db.add(RecommendationRule(**r, updated_at=datetime.now(timezone.utc)))
    db.commit()


def load_rules(db: Session) -> list[RecommendationRule]:
    rules = {r.intensity: r for r in db.query(RecommendationRule).all()}
    return [rules[i] for i in INTENSITIES if i in rules]


def classify(ndvi_mean: float | None, rules) -> str | None:
    """Return the intensity whose NDVI range [ndvi_min, ndvi_max) contains the value."""
    if ndvi_mean is None:
        return None
    for r in rules:
        lo = float("-inf") if r.ndvi_min is None else r.ndvi_min
        hi = float("inf") if r.ndvi_max is None else r.ndvi_max
        if lo <= ndvi_mean < hi:
            return r.intensity
    return None


def ranges_overlap(rules: list[dict]) -> bool:
    spans = sorted(
        (float("-inf") if r["ndvi_min"] is None else r["ndvi_min"],
         float("inf") if r["ndvi_max"] is None else r["ndvi_max"]) for r in rules
    )
    return any(spans[i][1] > spans[i + 1][0] for i in range(len(spans) - 1))
