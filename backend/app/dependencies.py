"""
FastAPI Dependency Injection providers for AgriMart routers, Authentication, and RBAC guards.
"""

from datetime import datetime, timezone
from typing import Callable, List, Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.core.config import Settings, settings
from backend.app.core.rbac import has_permission, has_role, normalize_roles
from backend.app.core.security import decode_jwt_token
from backend.app.models.user import UserProfileModel
from backend.app.schemas.auth import UserDTO
from backend.app.services.auth_service import AuthService

security_bearer = HTTPBearer(auto_error=False)


def get_settings() -> Settings:
    """Provides application configuration settings."""
    return settings


def get_utc_now() -> datetime:
    """Provides the current UTC timestamp for deterministic request evaluation."""
    return datetime.now(timezone.utc)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
) -> UserProfileModel:
    """
    Extracts and cryptographically verifies the JWT Bearer token from the Authorization header.
    Returns the authenticated UserProfileModel domain entity.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_jwt_token(token)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired JWT token: {str(err)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed JWT token: missing 'sub' subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = AuthService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user no longer exists in system.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_user_dto(
    user: UserProfileModel = Depends(get_current_user),
) -> UserDTO:
    """Provides the UserDTO representation of the currently authenticated user."""
    return AuthService.build_user_dto(user)


def require_roles(*allowed_roles: str) -> Callable:
    """
    Role-Based Access Control (RBAC) dependency factory.
    Verifies that the authenticated user possesses at least one of the allowed roles.
    Cooperative admins automatically bypass role checks.
    """
    def role_checker(user: UserProfileModel = Depends(get_current_user)) -> UserProfileModel:
        user_roles = normalize_roles(user.role_flags)
        if "admin" in user_roles:
            return user

        for r in allowed_roles:
            if has_role(user_roles, r):
                return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Access denied: This operation requires one of the following roles: "
                f"{list(allowed_roles)}. Your active roles: {user_roles}."
            ),
        )

    return role_checker


def require_permissions(*required_permissions: str) -> Callable:
    """
    Fine-grained permission dependency factory.
    Verifies that the authenticated user possesses all specified permissions.
    """
    def permission_checker(user: UserProfileModel = Depends(get_current_user)) -> UserProfileModel:
        user_roles = normalize_roles(user.role_flags)
        if "admin" in user_roles:
            return user

        for perm in required_permissions:
            if not has_permission(user_roles, perm):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        f"Access denied: Lacking required permission '{perm}'. "
                        f"Your roles: {user_roles}."
                    ),
                )

        return user

    return permission_checker
