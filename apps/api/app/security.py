"""Password hashing, cookie sessions (1 h idle timeout), role checks, login throttling."""
from __future__ import annotations

import hashlib
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import ActivityLog, SessionRow, User

_ph = PasswordHasher()
_DUMMY_HASH = _ph.hash("simponi-dummy-password")


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(hashed: str, password: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def burn_verify(password: str) -> None:
    """Equalise timing when the username does not exist."""
    verify_password(_DUMMY_HASH, password)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def idle_timeout(remember: bool) -> timedelta:
    s = get_settings()
    return timedelta(days=s.remember_me_days) if remember else timedelta(minutes=s.session_idle_minutes)


def create_session(db: Session, response: Response, user: User, remember: bool) -> None:
    s = get_settings()
    token = secrets.token_urlsafe(32)
    now = _now()
    db.add(SessionRow(
        id=_hash_token(token), user_id=user.id, remember=remember, created_at=now, last_seen_at=now,
        expires_at=now + idle_timeout(remember),
        absolute_expires_at=now + timedelta(days=s.remember_me_max_days) if remember else None,
    ))
    response.set_cookie(
        s.cookie_name, token, httponly=True, samesite="lax", secure=s.cookie_secure, path="/",
        max_age=int(timedelta(days=s.remember_me_max_days).total_seconds()) if remember else None,
    )


def destroy_session(db: Session, request: Request, response: Response) -> None:
    s = get_settings()
    token = request.cookies.get(s.cookie_name)
    if token:
        row = db.get(SessionRow, _hash_token(token))
        if row:
            db.delete(row)
            db.commit()
    response.delete_cookie(s.cookie_name, path="/")


def current_session(request: Request, db: Session = Depends(get_db)) -> tuple[User, SessionRow]:
    token = request.cookies.get(get_settings().cookie_name)
    unauth = HTTPException(401, "Sesi berakhir atau belum login. Silakan login kembali.")
    if not token:
        raise unauth
    row = db.get(SessionRow, _hash_token(token))
    now = _now()
    if row is None:
        raise unauth
    if row.expires_at <= now or (row.absolute_expires_at and row.absolute_expires_at <= now):
        db.delete(row)
        db.commit()
        raise unauth
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise unauth
    if (now - row.last_seen_at).total_seconds() > 30:  # slide the idle timeout
        row.last_seen_at = now
        row.expires_at = now + idle_timeout(row.remember)
        if row.absolute_expires_at:
            row.expires_at = min(row.expires_at, row.absolute_expires_at)
        db.commit()
    return user, row


def current_user(sess: tuple[User, SessionRow] = Depends(current_session)) -> User:
    return sess[0]


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Fitur ini hanya untuk admin.")
    return user


def log_activity(db: Session, user: User | None, action: str, detail: str | None = None, username: str | None = None) -> None:
    db.add(ActivityLog(user_id=user.id if user else None, username=user.username if user else (username or "-"),
                       action=action, detail=detail))


# --- login throttling (per process; use a shared store if the API is scaled out) ---
_failures: dict[str, deque] = defaultdict(deque)


def _key(username: str, ip: str) -> str:
    return f"{username.lower()}|{ip}"


def check_throttle(username: str, ip: str) -> None:
    s = get_settings()
    q = _failures[_key(username, ip)]
    cutoff = time.monotonic() - s.login_window_seconds
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= s.login_max_attempts:
        raise HTTPException(429, "Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.")


def record_failure(username: str, ip: str) -> None:
    _failures[_key(username, ip)].append(time.monotonic())


def clear_failures(username: str, ip: str) -> None:
    _failures.pop(_key(username, ip), None)
