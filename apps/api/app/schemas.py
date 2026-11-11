import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

USERNAME_RE = re.compile(r"^[a-z0-9._-]{3,32}$")
Role = Literal["user", "admin"]
Intensity = Literal["rendah", "sedang", "tinggi"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)
    remember: bool = False


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class UserCreate(BaseModel):
    username: str
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Role = "user"

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.match(v):
            raise ValueError("Username 3-32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.")
        return v


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class MapCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class MapUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class VersionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class PolygonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=1000)
    geometry: dict


class RuleAction(BaseModel):
    type: str = Field(min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=80)
    detail: str = Field(default="", max_length=500)
    level: Intensity
    interval_days: int = Field(ge=1, le=365)
    interval_label: str = Field(min_length=1, max_length=40)


class RuleUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=40)
    ndvi_min: float | None = Field(default=None, ge=-1, le=1)
    ndvi_max: float | None = Field(default=None, ge=-1, le=1)
    actions: list[RuleAction] | None = None
    notes: str | None = Field(default=None, max_length=1000)
    clear_min: bool = False  # set true to make the lower bound open-ended
    clear_max: bool = False
