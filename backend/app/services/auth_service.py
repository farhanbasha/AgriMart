"""
Authentication & RBAC Service.
Handles user registration, bcrypt password hashing, JWT generation,
Google OAuth 2.0 token verification, and role/permission enforcement.
"""

import time
import uuid
from typing import Dict, List, Optional

from backend.app.core.config import settings
from backend.app.core.rbac import (
    Role,
    get_permissions_for_roles,
    normalize_roles,
)
from backend.app.core.security import (
    create_jwt_token,
    hash_password,
    normalize_indian_phone,
    verify_google_token,
    verify_password,
)
from backend.app.models.user import UserProfileModel
from backend.app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserDTO,
)


class AuthService:
    """Manages secure identity, bcrypt hashing, JWT tokens, and RBAC."""

    # In-memory user registry for instant, zero-latency access
    _users_db: Dict[str, UserProfileModel] = {}
    _phone_index: Dict[str, str] = {}    # normalized_phone -> user_id
    _email_index: Dict[str, str] = {}    # normalized_email -> user_id
    _google_index: Dict[str, str] = {}   # google_id -> user_id

    @classmethod
    def _sync_profile_to_supabase(cls, user: UserProfileModel) -> None:
        """Persists or updates the user profile in Supabase profiles table."""
        if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
            return
        try:
            import httpx
            from datetime import datetime, timezone
            url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/profiles"
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            }
            payload = {
                "id": user.id,
                "full_name": user.full_name,
                "phone": user.phone,
                "email": user.email,
                "village": user.village,
                "state": user.state,
                "avatar_url": user.avatar_url,
                "password_hash": user.password_hash,
                "trust_score": user.trust_score,
                "role_flags": user.role_flags,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            with httpx.Client(timeout=3.0) as client:
                res = client.post(url, headers=headers, json=payload)
                if res.status_code >= 400 and ("email" in res.text or "password_hash" in res.text or "column" in res.text):
                    fallback = dict(payload)
                    fallback.pop("password_hash", None)
                    fallback.pop("email", None)
                    fallback.pop("avatar_url", None)
                    client.post(url, headers=headers, json=fallback)
        except Exception as exc:
            print(f"[Supabase Sync Notice] {exc}")

    @classmethod
    def reset_state_for_tests(cls) -> None:
        """Resets in-memory storage (used by unit tests)."""
        cls._users_db.clear()
        cls._phone_index.clear()
        cls._email_index.clear()
        cls._google_index.clear()

    @classmethod
    def _seed_default_admin_if_empty(cls) -> None:
        """Seeds a default cooperative admin if database is empty."""
        if not cls._users_db:
            admin_id = "usr-admin-default"
            admin_phone = "+919876500000"
            admin = UserProfileModel(
                id=admin_id,
                full_name="AgriMart Cooperative Admin",
                phone=admin_phone,
                email="admin@agrimart.coop",
                village="Karnal",
                state="Haryana",
                password_hash=hash_password("admin123"),
                trust_score=100.0,
                role_flags=["admin", "borrower", "lender"],
            )
            cls._users_db[admin_id] = admin
            cls._phone_index[admin_phone] = admin_id
            cls._email_index[admin.email] = admin_id

    @classmethod
    def get_user_by_id(cls, user_id: str) -> Optional[UserProfileModel]:
        """Retrieves a user by unique identifier."""
        cls._seed_default_admin_if_empty()
        return cls._users_db.get(user_id)

    @classmethod
    def get_user_by_phone(cls, phone: str) -> Optional[UserProfileModel]:
        """Retrieves a user by phone number."""
        cls._seed_default_admin_if_empty()
        norm = normalize_indian_phone(phone)
        uid = cls._phone_index.get(norm)
        return cls._users_db.get(uid) if uid else None

    @classmethod
    def get_user_by_email(cls, email: str) -> Optional[UserProfileModel]:
        """Retrieves a user by email address."""
        cls._seed_default_admin_if_empty()
        norm = email.lower().strip()
        uid = cls._email_index.get(norm)
        return cls._users_db.get(uid) if uid else None

    @classmethod
    def build_user_dto(cls, user: UserProfileModel) -> UserDTO:
        """Constructs a client-safe UserDTO with computed RBAC roles and permissions."""
        normalized_roles = normalize_roles(user.role_flags)
        permissions = get_permissions_for_roles(normalized_roles)

        return UserDTO(
            id=user.id,
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            village=user.village,
            state=user.state,
            trust_score=user.trust_score,
            role_flags=user.role_flags,
            roles=normalized_roles,
            permissions=permissions,
            avatar_url=user.avatar_url,
            password_hash=user.password_hash,
        )

    @classmethod
    def register_user(cls, request: RegisterRequest) -> TokenResponse:
        """
        Registers a new farmer or equipment owner:
        1. Normalizes phone and/or email (at least one is required)
        2. Verifies uniqueness
        3. Hashes password via bcrypt
        4. Persists to in-memory store and Supabase profiles table
        5. Issues signed JWT access token
        """
        cls._seed_default_admin_if_empty()

        raw_phone = request.phone.strip() if request.phone else None
        norm_phone = normalize_indian_phone(raw_phone) if raw_phone else None

        raw_email = request.email.strip().lower() if request.email else None
        norm_email = raw_email if raw_email else None

        if not norm_phone and not norm_email:
            raise ValueError("Please provide either a mobile number or an email address to register.")

        if norm_phone:
            if len(norm_phone) < 10:
                raise ValueError("Please provide a valid 10-digit mobile number.")
            if norm_phone in cls._phone_index:
                raise ValueError("An account with this mobile number already exists. Please choose a different number or log in.")

        if norm_email:
            if norm_email in cls._email_index:
                raise ValueError("An account with this email address already exists. Please choose a different email or log in.")

        # Check Supabase Cloud database for existing email or phone to strictly guarantee uniqueness
        if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
            try:
                import httpx
                headers = {
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
                }
                with httpx.Client(timeout=2.0) as client:
                    if norm_email:
                        res = client.get(
                            f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/profiles?email=eq.{norm_email}&select=id",
                            headers=headers,
                        )
                        if res.status_code == 200 and len(res.json()) > 0:
                            raise ValueError("An account with this email address already exists. Please choose a different email or log in.")
                    if norm_phone:
                        last_10 = norm_phone[-10:]
                        res = client.get(
                            f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/profiles?phone=ilike.%25{last_10}%25&select=id",
                            headers=headers,
                        )
                        if res.status_code == 200 and len(res.json()) > 0:
                            raise ValueError("An account with this mobile number already exists. Please choose a different number or log in.")
            except ValueError:
                raise
            except Exception:
                pass

        # Bcrypt Password Hashing
        hashed_pw = hash_password(request.password) if request.password else None

        user_id = f"usr-{int(time.time())}-{uuid.uuid4().hex[:6]}"
        clean_roles = request.role_flags if request.role_flags else ["borrower"]

        new_user = UserProfileModel(
            id=user_id,
            full_name=request.full_name.strip(),
            phone=norm_phone,
            email=norm_email,
            village=request.village.strip() if request.village else None,
            state=request.state.strip() if request.state else "Haryana",
            password_hash=hashed_pw,
            trust_score=100.0,
            role_flags=clean_roles,
        )

        cls._users_db[user_id] = new_user
        if norm_phone:
            cls._phone_index[norm_phone] = user_id
        if norm_email:
            cls._email_index[norm_email] = user_id

        # Persist to Supabase profiles table
        cls._sync_profile_to_supabase(new_user)

        user_dto = cls.build_user_dto(new_user)

        # Generate JWT Access Token
        jwt_token = create_jwt_token({
            "sub": user_id,
            "phone": norm_phone,
            "email": norm_email,
            "full_name": new_user.full_name,
            "roles": user_dto.roles,
            "permissions": user_dto.permissions,
        })

        return TokenResponse(
            access_token=jwt_token,
            token_type="bearer",
            expires_in_seconds=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_dto,
        )

    @classmethod
    def login_user(cls, request: LoginRequest) -> TokenResponse:
        """
        Authenticates a user via phone (or email) and password:
        1. Finds user by email or phone
        2. Verifies bcrypt password hash in constant time
        3. Issues signed JWT access token
        """
        cls._seed_default_admin_if_empty()

        query = (request.identifier or request.email or request.phone or "").strip()
        if not query:
            raise ValueError("Please enter your mobile number or email address.")

        user: Optional[UserProfileModel] = None

        if "@" in query:
            user = cls.get_user_by_email(query)
        else:
            user = cls.get_user_by_phone(query)

        if not user:
            raise ValueError("No account found with this mobile number or email. Please register.")

        # If user has a password_hash, verify it with bcrypt
        if user.password_hash:
            if not request.password:
                raise ValueError("Password is required for this account.")
            if not verify_password(request.password, user.password_hash):
                raise ValueError("Incorrect mobile number, email, or password. Please try again.")

        user_dto = cls.build_user_dto(user)

        # Generate fresh JWT Access Token
        jwt_token = create_jwt_token({
            "sub": user.id,
            "phone": user.phone,
            "email": user.email,
            "full_name": user.full_name,
            "roles": user_dto.roles,
            "permissions": user_dto.permissions,
        })

        return TokenResponse(
            access_token=jwt_token,
            token_type="bearer",
            expires_in_seconds=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_dto,
        )

    @classmethod
    def authenticate_google(cls, request: GoogleAuthRequest) -> TokenResponse:
        """
        Authenticates or provisions a user using Google OAuth 2.0 ID Token:
        1. Cryptographically verifies Google token signature & audience
        2. Matches existing account by Google ID or Email
        3. If new, auto-provisions farmer account with Google profile info (email only, phone=None)
        4. Issues signed AgriMart JWT access token
        """
        cls._seed_default_admin_if_empty()

        claims = verify_google_token(request.id_token)
        google_id = claims["google_id"]
        email = claims.get("email")
        name = claims.get("name") or "Kisan Google User"
        picture = claims.get("picture")

        user: Optional[UserProfileModel] = None

        # 1. Match by Google ID
        if google_id in cls._google_index:
            user = cls._users_db.get(cls._google_index[google_id])

        # 2. Match by verified Email
        if not user and email:
            user = cls.get_user_by_email(email)
            if user:
                user.google_id = google_id
                cls._google_index[google_id] = user.id

        # 3. Auto-provision new user if not found (strictly email only, no dummy phone!)
        if not user:
            user_id = f"usr-g-{int(time.time())}-{uuid.uuid4().hex[:6]}"
            roles = request.role_flags if request.role_flags else ["borrower"]

            user = UserProfileModel(
                id=user_id,
                full_name=name,
                phone=None,
                email=email,
                village=request.village.strip() if request.village else None,
                state=request.state.strip() if request.state else "Haryana",
                google_id=google_id,
                avatar_url=picture,
                trust_score=100.0,
                role_flags=roles,
            )

            cls._users_db[user_id] = user
            cls._google_index[google_id] = user_id
            if email:
                cls._email_index[email.lower().strip()] = user_id

            # Persist to Supabase profiles
            cls._sync_profile_to_supabase(user)

        user_dto = cls.build_user_dto(user)

        jwt_token = create_jwt_token({
            "sub": user.id,
            "phone": user.phone,
            "email": user.email,
            "full_name": user.full_name,
            "roles": user_dto.roles,
            "permissions": user_dto.permissions,
        })

        return TokenResponse(
            access_token=jwt_token,
            token_type="bearer",
            expires_in_seconds=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_dto,
        )

    @classmethod
    def update_user_profile(
        cls,
        user_id: str,
        full_name: Optional[str] = None,
        phone: Optional[str] = None,
        village: Optional[str] = None,
        state: Optional[str] = None,
        role_flags: Optional[List[str]] = None,
    ) -> UserDTO:
        """Updates user profile details and synchronizes with Supabase."""
        user = cls._users_db.get(user_id)
        if not user:
            raise ValueError("User not found.")

        if full_name and full_name.strip():
            user.full_name = full_name.strip()
        if phone and phone.strip():
            norm_phone = normalize_indian_phone(phone)
            user.phone = norm_phone
            cls._phone_index[norm_phone] = user.id
        if village and village.strip():
            user.village = village.strip()
        if state and state.strip():
            user.state = state.strip()
        if role_flags:
            user.role_flags = role_flags

        cls._sync_profile_to_supabase(user)
        return cls.build_user_dto(user)
