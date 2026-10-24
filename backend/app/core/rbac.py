"""
Role-Based Access Control (RBAC) System for AgriMart.
Defines roles, hierarchical permissions, and access verification logic.
"""

from enum import Enum
from typing import List, Set


class Role(str, Enum):
    """AgriMart cooperative domain roles."""
    BORROWER = "borrower"   # Farmer booking equipment
    LENDER = "lender"       # Equipment owner listing machines
    PROSUMER = "prosumer"   # Farmer who both rents & shares machinery
    ADMIN = "admin"         # Cooperative coordinator & dispute arbiter


class Permission(str, Enum):
    """Granular system permissions."""
    # Land Plots
    PLOTS_CREATE = "plots:create"
    PLOTS_READ = "plots:read"
    PLOTS_DELETE = "plots:delete"

    # Machinery & Resources
    RESOURCES_CREATE = "resources:create"
    RESOURCES_READ = "resources:read"
    RESOURCES_MANAGE = "resources:manage"

    # Bookings & Smart Scheduling
    BOOKINGS_CREATE = "bookings:create"
    BOOKINGS_READ = "bookings:read"
    BOOKINGS_CANCEL = "bookings:cancel"

    # Administrative & Crisis Operations
    ADMIN_ARBITRATE = "admin:arbitrate"
    ADMIN_DISRUPTION = "admin:disruption"
    ADMIN_ACCESS = "admin:access"


# Mapping from role to permissions
ROLE_PERMISSIONS: dict[str, Set[str]] = {
    Role.BORROWER.value: {
        Permission.PLOTS_CREATE.value,
        Permission.PLOTS_READ.value,
        Permission.PLOTS_DELETE.value,
        Permission.RESOURCES_READ.value,
        Permission.BOOKINGS_CREATE.value,
        Permission.BOOKINGS_READ.value,
        Permission.BOOKINGS_CANCEL.value,
    },
    Role.LENDER.value: {
        Permission.RESOURCES_CREATE.value,
        Permission.RESOURCES_READ.value,
        Permission.RESOURCES_MANAGE.value,
        Permission.BOOKINGS_READ.value,
        Permission.BOOKINGS_CANCEL.value,
    },
    Role.PROSUMER.value: {
        Permission.PLOTS_CREATE.value,
        Permission.PLOTS_READ.value,
        Permission.PLOTS_DELETE.value,
        Permission.RESOURCES_CREATE.value,
        Permission.RESOURCES_READ.value,
        Permission.RESOURCES_MANAGE.value,
        Permission.BOOKINGS_CREATE.value,
        Permission.BOOKINGS_READ.value,
        Permission.BOOKINGS_CANCEL.value,
    },
    Role.ADMIN.value: {
        Permission.PLOTS_CREATE.value,
        Permission.PLOTS_READ.value,
        Permission.PLOTS_DELETE.value,
        Permission.RESOURCES_CREATE.value,
        Permission.RESOURCES_READ.value,
        Permission.RESOURCES_MANAGE.value,
        Permission.BOOKINGS_CREATE.value,
        Permission.BOOKINGS_READ.value,
        Permission.BOOKINGS_CANCEL.value,
        Permission.ADMIN_ARBITRATE.value,
        Permission.ADMIN_DISRUPTION.value,
        Permission.ADMIN_ACCESS.value,
    },
}


def normalize_roles(roles: List[str]) -> List[str]:
    """Normalizes role strings, expanding dual borrower+lender into prosumer."""
    clean = set(r.lower().strip() for r in roles if r)
    if "borrower" in clean and "lender" in clean:
        clean.add("prosumer")
    if not clean:
        clean = {"borrower"}
    return sorted(clean)


def get_permissions_for_roles(roles: List[str]) -> List[str]:
    """Aggregates all distinct permissions granted to the given roles."""
    perms: Set[str] = set()
    normalized = normalize_roles(roles)

    for role_name in normalized:
        role_perms = ROLE_PERMISSIONS.get(role_name, set())
        perms.update(role_perms)

    return sorted(perms)


def has_role(user_roles: List[str], required_role: str) -> bool:
    """Checks if the user has a specific role (or admin privilege)."""
    normalized = set(normalize_roles(user_roles))
    if Role.ADMIN.value in normalized:
        return True
    return required_role.lower().strip() in normalized


def has_permission(user_roles: List[str], required_permission: str) -> bool:
    """Checks if the user roles contain a specific permission."""
    perms = set(get_permissions_for_roles(user_roles))
    return required_permission in perms
