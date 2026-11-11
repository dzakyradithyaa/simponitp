import os
import tempfile

# Must be set before the app is imported. Needs a PostgreSQL + PostGIS database (see README).
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://simponi:simponi@localhost:5432/simponi_test")
os.environ["STORAGE_DIR"] = tempfile.mkdtemp(prefix="simponi-test-")
os.environ["ADMIN_PASSWORD"] = "Admin12345"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def admin():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    with TestClient(app) as c:  # lifespan creates tables and seeds the admin + rules
        r = c.post("/api/auth/login", json={"username": "admin", "password": "Admin12345"})
        assert r.status_code == 200, r.text
        yield c


@pytest.fixture(scope="session")
def user(admin):
    r = admin.post("/api/users", json={"username": "petugas1", "full_name": "Petugas Satu",
                                       "password": "Petugas123", "role": "user"})
    assert r.status_code == 201, r.text
    with TestClient(app) as c:
        assert c.post("/api/auth/login", json={"username": "petugas1", "password": "Petugas123"}).status_code == 200
        yield c
