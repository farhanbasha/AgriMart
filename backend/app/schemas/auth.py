"""
Pydantic Schemas for Authentication, Registration, JWT Tokens, and RBAC.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=120)
    village: Optional[str] = None
    state: Optional[str] = "Haryana"
    password: Optional[str] = Field(None, min_length=4, max_length=128)
    role_flags: List[str] = Field(default_factory=lambda: ["borrower"])


class LoginRequest(BaseModel):
    identifier: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., min_length=10)
    role_flags: Optional[List[str]] = None
    village: Optional[str] = None
    state: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    village: Optional[str] = None
    state: Optional[str] = None
    role_flags: Optional[List[str]] = None


class UserDTO(BaseModel):
    id: str
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    village: Optional[str] = None
    state: Optional[str] = None
    trust_score: float = 100.0
    role_flags: List[str]
    roles: List[str]
    permissions: List[str]
    avatar_url: Optional[str] = None
    password_hash: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserDTO


class PermissionsResponse(BaseModel):
    user_id: str
    roles: List[str]
    permissions: List[str]
