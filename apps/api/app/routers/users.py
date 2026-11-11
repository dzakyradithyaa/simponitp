from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import SessionRow, User
from ..schemas import UserCreate, UserOut, UserUpdate
from ..security import hash_password, log_activity, require_admin

router = APIRouter(prefix="/api/users", tags=["users"])


def _active_admins(db: Session) -> int:
    return db.query(User).filter(User.role == "admin", User.is_active.is_(True)).count()


@router.get("", response_model=list[UserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(409, "Username sudah dipakai.")
    user = User(username=body.username, full_name=body.full_name.strip(), role=body.role,
                password_hash=hash_password(body.password))
    db.add(user)
    log_activity(db, admin, "create_user", f"{body.username} ({body.role})")
    db.commit()
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Pengguna tidak ditemukan.")
    losing_admin = user.role == "admin" and user.is_active and (
        body.role == "user" or body.is_active is False
    )
    if losing_admin and _active_admins(db) <= 1:
        raise HTTPException(409, "Minimal harus ada satu admin aktif.")
    if user.id == admin.id and (body.role == "user" or body.is_active is False):
        raise HTTPException(409, "Anda tidak dapat menurunkan atau menonaktifkan akun Anda sendiri.")
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.password is not None or body.is_active is False:  # force re-login
        db.query(SessionRow).filter(SessionRow.user_id == user.id).delete()
    log_activity(db, admin, "update_user", user.username)
    db.commit()
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Pengguna tidak ditemukan.")
    if user.id == admin.id:
        raise HTTPException(409, "Anda tidak dapat menghapus akun Anda sendiri.")
    if user.role == "admin" and user.is_active and _active_admins(db) <= 1:
        raise HTTPException(409, "Minimal harus ada satu admin aktif.")
    log_activity(db, admin, "delete_user", user.username)
    db.delete(user)
    db.commit()
