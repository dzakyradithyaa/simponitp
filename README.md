# SIMPONI TP

SIMPONI TP is a web-based precision agriculture platform for managing agricultural areas, UAV-derived geospatial data, drone operation planning, and decision support.

The project combines UAV imagery, GIS layers, soil measurements, and operational recommendations to support agricultural monitoring and spraying missions.

## Project Goals

- Display agricultural areas and geospatial layers on a web dashboard.
- Upload maps as TIFF (GeoTIFF NDVI). They are converted to PMTiles and shown with MapLibre on top of an OpenStreetMap base map.
- Divide operational areas into 100 x 100 meter blocks.
- Define custom spraying polygons.
- Provide basic intensity-based recommendations.
- Download 100 x 100 m blocks and custom (manually drawn) polygons as KML/KMZ files for drone mission planning. KML/KMZ is download only; nothing is uploaded in that format.
- Prepare the platform for future soil analysis and agricultural intelligence.

## Quick start (Docker)

```bash
cp .env.example .env        # set POSTGRES_PASSWORD and ADMIN_PASSWORD
docker compose up --build
```

Open <http://localhost:3000> and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`. The admin account is created only
when the database has no users. API docs are at <http://localhost:3000/api/docs> (set `ENABLE_DOCS=false` in production).

First steps as admin: **Upload Peta** (new map + TIFF) -> **Peta Saya**. The map area is taken from the first TIFF.

Upgrading from an earlier build: the database schema changed, so run `docker compose down -v` once (this deletes existing data).

## Local development

Requirements: Python 3.12, Node 20+, PostgreSQL 16 with PostGIS.

```bash
# API
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                       # adjust DATABASE_URL / ADMIN_PASSWORD
uvicorn app.main:app --reload --port 8000

# Web (another terminal)
cd apps/web
cp .env.example .env.local
npm install && npm run dev                 # http://localhost:3000
```

Tests (need a PostGIS database; the suite drops and recreates the `public` schema of that database):

```bash
createdb simponi_test
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/simponi_test pytest      # in apps/api
```

## Pages

| Page | Who | Purpose |
|---|---|---|
| Login | all | Username/password, optional "remember me" |
| Dashboard | all | Greeting and a short summary of the main map |
| Peta Saya | all | OpenStreetMap base map with layers (boundary, 1 ha blocks, TIFF map, custom polygons), map version selector, **Lihat petak** and **Custom petak** modes, recommendation analysis per intensity, KML/KMZ download |
| Upload Peta | admin | The only upload page: TIFF files (one or many) into a new or existing map, processing status, and version management (activate, rename, delete) |
| Admin Panel | admin | Usage and activity log per user |
| Manajemen Akun | admin | Create, edit, deactivate, delete accounts (roles: `user`, `admin`) |
| FAQ | all | Short answers for field users |

The session expires after 1 hour of inactivity (7 days idle with "remember me"). The UI is in Indonesian, with a TNI-inspired
green/khaki/gold theme.

## System Flowchart

```mermaid
flowchart TD
    A[User Login] --> B{Role}
    B -->|User: Read-only| C[View Dashboard and Maps]
    B -->|Admin: Full Access| D[Admin Panel]

    C --> E[View Map Layers]
    E --> F[Automatically Generated Recommendations]
    C --> G[Create Custom Polygon]
    G --> H[Export KML/KMZ]
    C --> I[FAQ]

    D --> J[Upload Map TIFF]
    D --> K[Manage Map Layers and Versions]
    D --> G
    D --> N[Manage User Accounts]

    K --> O[Future: NDVI and Soil Analysis]
    O --> P[Future: Interpolation and Prediction]
```

## Architecture

SIMPONI TP uses a modular monolith to keep the first release simple while leaving room for future geospatial processing.

```text
Next.js dashboard (MapLibre GL + PMTiles on an OpenStreetMap base map)
        |
        v
FastAPI REST API
        |
        +--> PostgreSQL + PostGIS
        |
        +--> Uploaded GeoTIFF, generated PMTiles, and on-demand KML/KMZ downloads
```

See `docs/architecture.md` for the data flow and security notes.

### Technology Stack

- **Frontend:** Next.js 14, TypeScript, and Tailwind CSS.
- **Map interface:** MapLibre GL JS with the PMTiles protocol; OpenStreetMap base map.
- **Backend:** FastAPI and Python (SQLAlchemy, GeoAlchemy2, Shapely, pyproj, rasterio).
- **Database:** PostgreSQL with PostGIS.
- **File storage:** Local storage for development; S3-compatible storage can be added later.
- **Authentication:** HTTP-only cookie-based sessions with `user` and `admin` roles.
- **Deployment:** Docker Compose.

The `user` role has limited access: it can view dashboards, map layers, and automatically generated recommendations, create a custom polygon, and export that polygon as KML/KMZ. The `admin` role has full access to uploads, map and layer management, exports, and user accounts.

## Repository Structure

```text
simponitp/
├─ apps/
│  ├─ web/          # Next.js dashboard and map interface
│  └─ api/          # FastAPI API and business logic
├─ packages/        # Shared contracts or utilities, only when needed
├─ database/        # PostgreSQL/PostGIS init scripts
├─ storage/         # Uploaded and generated geospatial files (local development)
├─ docs/            # Technical and project documentation
├─ docker-compose.yml
└─ README.md
```

## Backend Modules

- `auth` - authentication, sessions, and role checks.
- `users` - user and administrator management.
- `maps` - TIFF uploads, GeoTIFF -> PMTiles conversion, and map versions.
- `grids` - operational block generation (default 100 m, set `GRID_CELL_SIZE_M` to adapt to drone capacity).
- `recommendations` - configurable intensity and action recommendations.
- `exports` - KML/KMZ generation (download only).
- `polygons`, `dashboard`, `admin` - custom polygons, summary data, per-user activity.
- `processing` - future NDVI, interpolation, and prediction workflows (Phase 2). Phase 1 only validates NDVI GeoTIFFs and computes block statistics.

## Current Status

Phase 1 is implemented: area management, 1 ha grid, intensity classification from NDVI, recommendations, custom polygons,
KML/KMZ export, versions, accounts, and activity log.

Still to be confirmed with the project team (see `docs/open-decisions.md`):

- **Recommendation rules are a draft.** NDVI thresholds, actions, and intervals have not been validated by agronomy experts (`docs/recommendation-rules.md`).
- **KML/KMZ compatibility with drone software (for example TrueSprayer) has not been tested.**
- GeoTIFF specification, ArcGIS Cloud / middleware integration, and the final demonstration date.

Not in Phase 1: soil sensor data, interpolation (IDW, Kriging, Random Forest), and prediction maps for N, P, K, pH, and EC.

## Important Data Notes

The Kayangan area dataset is a proposed initial dataset and must be verified before use. Required data may include UAV imagery, NDVI/GeoTIFF files, agricultural boundaries, soil sample coordinates, and soil parameter values.

Do not commit private datasets, credentials, or sensitive operational information to this repository.

The base map uses the public OpenStreetMap tile server, which is fine for development but has a usage policy. For production traffic,
use your own tile server or a provider and set `NEXT_PUBLIC_TILES_STREETS`.

## Future Integrations

- ArcGIS Cloud or another geospatial data provider.
- Middleware for dataset transfer.
- Drone mission planning software such as TrueSprayer.
- Soil sensor and agricultural intelligence workflows.

## License

License information will be added when the project licensing decision is finalized.
