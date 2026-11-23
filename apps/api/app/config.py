from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://simponi:simponi@localhost:5432/simponi"
    storage_dir: Path = Path("../../storage")

    # Session / cookie
    cookie_name: str = "simponi_session"
    cookie_secure: bool = False  # set true when served over HTTPS
    session_idle_minutes: int = 60  # session timeout: 1 hour of inactivity
    remember_me_days: int = 7  # idle timeout when "remember me" is ticked
    remember_me_max_days: int = 30  # absolute limit for "remember me" sessions
    allowed_origins: str = "http://localhost:3000"
    enable_docs: bool = True  # Swagger UI at /api/docs; set false in production

    # Login throttling
    login_max_attempts: int = 5
    login_window_seconds: int = 300

    # Geospatial
    grid_cell_size_m: int = 100  # 100 x 100 m = 1 ha
    grid_min_coverage: float = 0.05  # skip edge cells covering < 5% of a full cell
    max_cells: int = 20000
    max_polygon_ha: float = 5000
    max_upload_mb: int = 10240

    # First admin (created only when the users table is empty)
    admin_username: str = "admin"
    admin_password: str | None = None
    admin_full_name: str = "Administrator"

    @property
    def origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.storage_dir = Path(s.storage_dir).resolve()
    return s
