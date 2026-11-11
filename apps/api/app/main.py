import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import get_settings
from .db import Base, SessionLocal, engine
from .routers import admin, auth, dashboard, exports, grids, maps, polygons, recommendations, users
from .seed import purge_expired_sessions, seed_admin
from .services.recommend import seed_rules

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_settings().storage_dir.mkdir(parents=True, exist_ok=True)
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    Base.metadata.create_all(engine)  # TODO: replace with Alembic migrations once the schema stabilises
    with SessionLocal() as db:
        seed_rules(db)
        seed_admin(db)
        purge_expired_sessions(db)
    yield


app = FastAPI(
    title="SIMPONI TP API", version="0.1.0", lifespan=lifespan, redoc_url=None,
    docs_url="/api/docs" if get_settings().enable_docs else None,
    openapi_url="/api/openapi.json" if get_settings().enable_docs else None,
)


@app.middleware("http")
async def origin_check(request: Request, call_next):
    """CSRF defence in depth on top of SameSite=Lax: reject state-changing requests from other origins."""
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in get_settings().origins:
            return JSONResponse({"detail": "Origin tidak diizinkan."}, status_code=403)
    return await call_next(request)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}


for r in (auth, users, maps, grids, recommendations, polygons, exports, dashboard, admin):
    app.include_router(r.router)
