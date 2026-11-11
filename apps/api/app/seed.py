import logging
import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .config import get_settings
from .models import SessionRow, User
from .security import hash_password

log = logging.getLogger("simponi")


def seed_admin(db: Session) -> None:
    if db.query(User).count() > 0:
        return
    s = get_settings()
    password = s.admin_password
    generated = password is None
    if generated:
        password = secrets.token_urlsafe(12)
    db.add(User(username=s.admin_username.lower(), full_name=s.admin_full_name, role="admin",
                password_hash=hash_password(password)))
    db.commit()
    if generated:
        log.warning("Admin pertama dibuat. username=%s password=%s (ganti segera; set ADMIN_PASSWORD di .env)",
                    s.admin_username, password)
    else:
        log.info("Admin pertama dibuat: %s", s.admin_username)


def purge_expired_sessions(db: Session) -> None:
    now = datetime.now(timezone.utc)
    db.query(SessionRow).filter(SessionRow.expires_at <= now).delete()
    db.commit()
