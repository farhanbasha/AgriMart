"""
Authentication, Registration, Google OAuth, and RBAC Endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.core.rbac import (
    Permission,
    Role,
    get_permissions_for_roles,
    has_permission,
    has_role,
    normalize_roles,
)
from backend.app.dependencies import (
    get_current_user,
    get_current_user_dto,
    require_roles,
)
from backend.app.models.user import UserProfileModel
from backend.app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    PermissionsResponse,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserDTO,
)
from backend.app.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & RBAC"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Farmer or Equipment Owner",
    description="Registers a new user, hashes password/PIN with bcrypt, and issues a signed JWT access token.",
)
def register(request: RegisterRequest) -> TokenResponse:
    try:
        return AuthService.register_user(request)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Log In with Mobile/Email & Password",
    description="Authenticates credentials against bcrypt hash and issues a fresh signed JWT access token.",
)
def login(request: LoginRequest) -> TokenResponse:
    try:
        return AuthService.login_user(request)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(err),
        )


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign In or Register with Google OAuth 2.0",
    description="Verifies a Google ID Token, links or auto-provisions user profile, and returns an AgriMart JWT token.",
)
def google_auth(request: GoogleAuthRequest) -> TokenResponse:
    try:
        return AuthService.authenticate_google(request)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/me",
    response_model=UserDTO,
    status_code=status.HTTP_200_OK,
    summary="Get Authenticated User Profile",
    description="Returns the profile, computed RBAC roles, and granted permissions of the JWT bearer.",
)
def get_current_user_profile(
    user_dto: UserDTO = Depends(get_current_user_dto),
) -> UserDTO:
    return user_dto


@router.post(
    "/profile/update",
    response_model=UserDTO,
    status_code=status.HTTP_200_OK,
    summary="Update User Profile",
    description="Updates user profile fields (village, state, phone, name, roles) and synchronizes to Supabase.",
)
def update_profile(
    request: UpdateProfileRequest,
    current_user: UserProfileModel = Depends(get_current_user),
) -> UserDTO:
    try:
        return AuthService.update_user_profile(
            user_id=current_user.id,
            full_name=request.full_name,
            phone=request.phone,
            village=request.village,
            state=request.state,
            role_flags=request.role_flags,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )


@router.get(
    "/rbac/permissions",
    response_model=PermissionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Inspect Granted RBAC Permissions",
    description="Returns the effective permissions list for the authenticated user's assigned roles.",
)
def get_rbac_permissions(
    user: UserProfileModel = Depends(get_current_user),
) -> PermissionsResponse:
    roles = normalize_roles(user.role_flags)
    permissions = get_permissions_for_roles(roles)
    return PermissionsResponse(
        user_id=user.id,
        roles=roles,
        permissions=permissions,
    )


@router.get(
    "/rbac/verify",
    status_code=status.HTTP_200_OK,
    summary="Check Specific Role or Permission",
    description="Evaluates whether the caller has a required role or permission scope.",
)
def verify_access(
    role: Optional[str] = Query(None, description="Role name to test (e.g. lender, borrower)"),
    permission: Optional[str] = Query(None, description="Permission to test (e.g. resources:create)"),
    user: UserProfileModel = Depends(get_current_user),
):
    roles = normalize_roles(user.role_flags)
    role_allowed = has_role(roles, role) if role else True
    perm_allowed = has_permission(roles, permission) if permission else True

    allowed = role_allowed and perm_allowed
    return {
        "user_id": user.id,
        "is_allowed": allowed,
        "requested_role": role,
        "role_matches": role_allowed,
        "requested_permission": permission,
        "permission_matches": perm_allowed,
        "user_roles": roles,
    }


# Sample protected endpoint demonstrating role guarding
@router.get(
    "/admin/audit-summary",
    status_code=status.HTTP_200_OK,
    summary="Protected Admin Audit Endpoint",
    description="Protected endpoint accessible only by users with 'admin' role.",
)
def get_admin_audit_summary(
    admin_user: UserProfileModel = Depends(require_roles("admin")),
):
    return {
        "status": "authorized",
        "admin_id": admin_user.id,
        "admin_name": admin_user.full_name,
        "message": "AgriMart RBAC: Access granted to cooperative administrative controls.",
    }
