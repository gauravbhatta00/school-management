"""
Custom DRF permission classes for Role-Based Access Control.

These are composable — combine them with DRF's built-ins using | and &.
"""

from rest_framework.permissions import BasePermission


class IsSchoolAdmin(BasePermission):
    """Allow access only to users with the 'admin' role."""

    message = "Only school administrators can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsTeacher(BasePermission):
    """Allow access only to teachers."""

    message = "Only teachers can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "teacher"
        )


class IsStudent(BasePermission):
    """Allow access only to students."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "student"
        )


class IsAdminOrTeacher(BasePermission):
    """Allow admins and teachers (read-heavy endpoints)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("admin", "teacher")
        )


class IsSameSchool(BasePermission):
    """Object-level: user can only access objects from their own school."""

    def has_object_permission(self, request, view, obj):
        user_school = getattr(request.user, "school", None)
        obj_school = getattr(obj, "school", None)
        return user_school is not None and user_school == obj_school


class AnyOf(BasePermission):
    """Permission combinator: allow if ANY of the provided permissions allow.

    Usage: `AnyOf(IsAdminOrTeacher, IsStudent)` in `get_permissions()`.
    Accepts permission classes (not instances) or permission instances.
    """

    def __init__(self, *perms):
        # Normalize to instances
        self.perms = []
        for p in perms:
            if isinstance(p, BasePermission):
                self.perms.append(p)
            elif isinstance(p, type):
                self.perms.append(p())
            else:
                raise TypeError(
                    "Permissions must be classes or BasePermission instances"
                )

    def has_permission(self, request, view):
        return any(p.has_permission(request, view) for p in self.perms)

    def has_object_permission(self, request, view, obj):
        # If any permission defines object-level and returns True, allow.
        results = []
        for p in self.perms:
            fn = getattr(p, "has_object_permission", None)
            if fn is None:
                # if permission doesn't implement object-level, treat as permissive for object checks
                results.append(True)
            else:
                results.append(fn(request, view, obj))
        return any(results)
