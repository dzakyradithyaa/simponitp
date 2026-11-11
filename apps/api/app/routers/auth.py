from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import SessionRow, User
from ..schemas import LoginIn, UserOut
from ..security import (
    burn_verify, check_throttle, clear_failures, create_session, current_session, destroy_session,
    idle_timeout, log_activity, record_failure, verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _session_info(user: User, remember: bool) -> dict:
    return {"user": UserOut.model_validate(user), "idle_timeout_seconds": int(idle_timeout(remember).total_seconds())}


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "-"
    username = body.username.strip().lower()
    check_throttle(username, ip)
    user = db.query(User).filter(User.username == username).one_or_none()
    ok = False
    if user is None:
        burn_verify(body.password)
    else:
        ok = verify_password(user.password_hash, body.password) and user.is_active
    if not ok:
        record_failure(username, ip)
        log_activity(db, None, "login_failed", None, username=username[:32])
        db.commit()
        raise HTTPException(401, "Username atau password salah.")
    clear_failures(username, ip)
    user.last_login_at = datetime.now(timezone.utc)
    create_session(db, response, user, body.remember)
    log_activity(db, user, "login", "remember" if body.remember else None)
    db.commit()
    return _session_info(user, body.remember)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    destroy_session(db, request, response)


@router.get("/me")
def me(sess: tuple[User, SessionRow] = Depends(current_session)):
    user, row = sess
    return _session_info(user, row.remember)
