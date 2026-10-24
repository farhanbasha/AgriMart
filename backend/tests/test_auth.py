"""
Comprehensive unit tests for AgriMart Authentication, Bcrypt Hashing,
JWT Token Life-cycle, Google OAuth 2.0, and Role-Based Access Control (RBAC).
"""

import sys
import unittest
from datetime import timedelta
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from backend.app.core.rbac import (
    Permission,
    Role,
    get_permissions_for_roles,
    has_permission,
    has_role,
    normalize_roles,
)
from backend.app.core.security import (
    create_jwt_token,
    decode_jwt_token,
    hash_password,
    verify_google_token,
    verify_password,
)
from backend.app.dependencies import require_roles
from backend.app.models.user import UserProfileModel
from backend.app.routers.auth import (
    google_auth,
    login,
    register,
)
from backend.app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
)
from backend.app.services.auth_service import AuthService
from fastapi import HTTPException


class TestAgriMartAuthAndRBAC(unittest.TestCase):
    def setUp(self):
        AuthService.reset_state_for_tests()

    # --- 1. Bcrypt Password Hashing Tests ---

    def test_bcrypt_hashing_and_verification(self):
        plain_pin = "4829"
        hashed = hash_password(plain_pin)

        # Ensure hash is in standard bcrypt modular format
        self.assertTrue(hashed.startswith(("$2a$", "$2b$", "$2y$")))
        self.assertNotEqual(plain_pin, hashed)

        # Successful verification
        self.assertTrue(verify_password(plain_pin, hashed))

        # Rejection of incorrect password
        self.assertFalse(verify_password("0000", hashed))
        self.assertFalse(verify_password("4828", hashed))
        self.assertFalse(verify_password("", hashed))

    # --- 2. JWT Access Token Tests ---

    def test_jwt_token_creation_and_payload_claims(self):
        payload = {
            "sub": "usr-test-101",
            "phone": "+919876543210",
            "full_name": "Sukhwinder Singh",
            "roles": ["borrower"],
            "permissions": ["plots:create", "bookings:create"],
        }
        token = create_jwt_token(payload, expires_delta=timedelta(hours=2))
        self.assertIsInstance(token, str)

        decoded = decode_jwt_token(token)
        self.assertEqual(decoded["sub"], "usr-test-101")
        self.assertEqual(decoded["phone"], "+919876543210")
        self.assertEqual(decoded["full_name"], "Sukhwinder Singh")
        self.assertIn("plots:create", decoded["permissions"])
        self.assertIn("exp", decoded)
        self.assertIn("iat", decoded)

    def test_jwt_token_expiration(self):
        payload = {"sub": "usr-expired"}
        # Create token already expired 10 seconds ago
        expired_token = create_jwt_token(payload, expires_delta=timedelta(seconds=-10))

        with self.assertRaises(Exception):
            decode_jwt_token(expired_token)

    def test_jwt_tampered_token_rejection(self):
        token = create_jwt_token({"sub": "usr-valid"})
        tampered = token[:-4] + "xyz1"

        with self.assertRaises(Exception):
            decode_jwt_token(tampered)

    # --- 3. Role-Based Access Control (RBAC) Tests ---

    def test_rbac_role_normalization_and_prosumer_expansion(self):
        # Dual borrower + lender is normalized to include prosumer
        roles = normalize_roles(["borrower", "lender"])
        self.assertIn("borrower", roles)
        self.assertIn("lender", roles)
        self.assertIn("prosumer", roles)

    def test_rbac_borrower_permissions(self):
        perms = get_permissions_for_roles(["borrower"])
        # Borrower has plot and booking permissions
        self.assertIn("plots:create", perms)
        self.assertIn("bookings:create", perms)
        self.assertIn("resources:read", perms)

        # Borrower cannot list/manage equipment or arbitrate
        self.assertNotIn("resources:create", perms)
        self.assertNotIn("resources:manage", perms)
        self.assertNotIn("admin:arbitrate", perms)

    def test_rbac_lender_permissions(self):
        perms = get_permissions_for_roles(["lender"])
        # Lender has equipment management permissions
        self.assertIn("resources:create", perms)
        self.assertIn("resources:manage", perms)
        self.assertIn("bookings:read", perms)

        # Pure lender does not create plots
        self.assertNotIn("plots:create", perms)
        self.assertNotIn("admin:arbitrate", perms)

    def test_rbac_prosumer_permissions(self):
        perms = get_permissions_for_roles(["prosumer"])
        # Prosumer has full operational permissions for both field and fleet
        self.assertIn("plots:create", perms)
        self.assertIn("resources:create", perms)
        self.assertIn("bookings:create", perms)
        self.assertNotIn("admin:arbitrate", perms)

    def test_rbac_admin_permissions(self):
        perms = get_permissions_for_roles(["admin"])
        # Admin has full administrative and arbitration powers
        self.assertIn("admin:arbitrate", perms)
        self.assertIn("admin:disruption", perms)
        self.assertIn("admin:access", perms)
        self.assertIn("resources:create", perms)

    def test_rbac_has_role_and_permission_helpers(self):
        self.assertTrue(has_role(["borrower"], "borrower"))
        self.assertFalse(has_role(["borrower"], "lender"))
        # Admin has universal role match
        self.assertTrue(has_role(["admin"], "lender"))

        self.assertTrue(has_permission(["lender"], "resources:create"))
        self.assertFalse(has_permission(["lender"], "plots:create"))

    # --- 4. User Registration Flow ---

    def test_register_new_farmer_with_bcrypt(self):
        req = RegisterRequest(
            full_name="Harpreet Kaur",
            phone="9876512345",
            email="harpreet@kisan.in",
            village="Samana",
            state="Punjab",
            password="securepin98",
            role_flags=["borrower"],
        )
        res = register(req)
        self.assertIsNotNone(res.access_token)
        self.assertEqual(res.token_type, "bearer")
        self.assertEqual(res.user.full_name, "Harpreet Kaur")
        self.assertEqual(res.user.phone, "+919876512345")
        self.assertIn("borrower", res.user.roles)
        self.assertIn("plots:create", res.user.permissions)

        # Verify password in DB is bcrypt-hashed and NOT plain text
        saved_user = AuthService.get_user_by_id(res.user.id)
        self.assertIsNotNone(saved_user)
        self.assertNotEqual(saved_user.password_hash, "securepin98")
        self.assertTrue(verify_password("securepin98", saved_user.password_hash))

    def test_register_duplicate_phone_rejected(self):
        req = RegisterRequest(
            full_name="User 1",
            phone="9876543210",
            role_flags=["borrower"],
        )
        register(req)

        # Duplicate registration with same phone
        with self.assertRaises(HTTPException) as ctx:
            register(req)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already exists", ctx.exception.detail)

    def test_register_with_email_only_no_phone(self):
        req = RegisterRequest(
            full_name="Kiran Patel",
            email="kiran.patel@agri.in",
            village="Anand",
            state="Gujarat",
            password="securepassword123",
            role_flags=["borrower"],
        )
        res = register(req)
        self.assertIsNotNone(res.access_token)
        self.assertEqual(res.user.email, "kiran.patel@agri.in")
        self.assertIsNone(res.user.phone)

        # Login with email
        login_res = login(LoginRequest(email="kiran.patel@agri.in", password="securepassword123"))
        self.assertIsNotNone(login_res.access_token)
        self.assertEqual(login_res.user.full_name, "Kiran Patel")

    # --- 5. User Login Flow ---

    def test_login_successful_with_bcrypt_verification(self):
        reg = RegisterRequest(
            full_name="Gurmeet Singh",
            phone="9812345678",
            password="pass1234",
            role_flags=["lender"],
        )
        register(reg)

        login_req = LoginRequest(phone="9812345678", password="pass1234")
        login_res = login(login_req)
        self.assertIsNotNone(login_res.access_token)
        self.assertEqual(login_res.user.full_name, "Gurmeet Singh")
        self.assertIn("lender", login_res.user.roles)
        self.assertIn("resources:create", login_res.user.permissions)

    def test_login_incorrect_password_rejected(self):
        reg = RegisterRequest(
            full_name="Rajesh Sharma",
            phone="9876000000",
            password="correct_pin",
        )
        register(reg)

        wrong_req = LoginRequest(phone="9876000000", password="wrong_pin")
        with self.assertRaises(HTTPException) as ctx:
            login(wrong_req)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Incorrect", ctx.exception.detail)

    # --- 6. Google OAuth 2.0 Integration ---

    def test_google_oauth_provisioning_and_login(self):
        # Simulated Google ID token format: test-google-<email>:<name>
        token_str = "test-google-:kuldeep@gmail.com:Kuldeep Yadav"
        req = GoogleAuthRequest(
            id_token=token_str,
            role_flags=["borrower", "lender"],
            village="Karnal",
            state="Haryana",
        )
        res = google_auth(req)
        self.assertIsNotNone(res.access_token)
        self.assertEqual(res.user.email, "kuldeep@gmail.com")
        self.assertEqual(res.user.full_name, "Kuldeep Yadav")
        self.assertIn("prosumer", res.user.roles)
        self.assertIn("plots:create", res.user.permissions)
        self.assertIn("resources:create", res.user.permissions)

        # Logging in second time with same Google token retrieves the same user
        res2 = google_auth(req)
        self.assertEqual(res2.user.id, res.user.id)

    # --- 7. Dependency Role Guarding ---

    def test_require_roles_guard(self):
        borrower_user = UserProfileModel(
            id="usr-b1",
            full_name="Farmer Only",
            phone="+919800000001",
            role_flags=["borrower"],
        )
        admin_user = UserProfileModel(
            id="usr-a1",
            full_name="Admin",
            phone="+919800000002",
            role_flags=["admin"],
        )

        admin_guard = require_roles("admin")

        # Admin user passes guard
        passed_user = admin_guard(admin_user)
        self.assertEqual(passed_user.id, "usr-a1")

        # Borrower user is rejected with 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            admin_guard(borrower_user)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Access denied", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
