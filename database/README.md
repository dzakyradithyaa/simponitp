# Database

PostgreSQL 16 + PostGIS 3.4.

- `init/` runs on first start of the Docker volume (enables PostGIS).
- Tables are created by the API on startup (`Base.metadata.create_all`). That is enough for the first
  release; once the schema is stable, replace it with Alembic migrations in this folder.
